import { DELIVERY_STATUS, ORDER_PRIORITY, ORDER_STATUS, USER_ROLES } from '../constants/index.js';
import mongoose from 'mongoose';
import config from '../config/env.config.js';
import DeliveryRepository from '../repositories/delivery.repository.js';
import OrderRepository from '../repositories/order.repository.js';
import UserRepository from '../repositories/user.repository.js';
import { createError, ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';

class DeliveryService {
    constructor() {
    this.deliveryRepository = new DeliveryRepository();
    this.orderRepository = new OrderRepository();
    this.userRepository = new UserRepository();
    }

    async getAllDeliveries(query = {}) {
    const pagination = this.buildPagination(query);
    const filter = {};

    if (query.status) {
        filter.status = String(query.status).trim().toLowerCase();
    }

    if (query.driver) {
        filter.driver = query.driver;
    }

    if (query.order) {
        filter.order = query.order;
    }

    return this.deliveryRepository.findAll({ filter, pagination });
    }

    async getDeliveryById(id) {
    const delivery = await this.deliveryRepository.findById(id);
    if (!delivery) {
        throw createError(
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.name,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.message,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.status,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.code
        );
    }

    return delivery;
    }

    async createDelivery(deliveryData) {
    if (!deliveryData.order) {
        throw createError(
            ErrorDictionary.BAD_REQUEST_ERROR.name,
            ErrorDictionary.BAD_REQUEST_ERROR.message,
            ErrorDictionary.BAD_REQUEST_ERROR.status,
            ErrorDictionary.BAD_REQUEST_ERROR.code
        );
    }

    const order = await this.orderRepository.findById(deliveryData.order);
    if (!order) {
        throw createError(
            ErrorDictionary.ORDER_NOT_FOUND_ERROR.name,
            ErrorDictionary.ORDER_NOT_FOUND_ERROR.message,
            ErrorDictionary.ORDER_NOT_FOUND_ERROR.status,
            ErrorDictionary.ORDER_NOT_FOUND_ERROR.code
        );
    }

    const existingDeliveryForOrder = await this.deliveryRepository.findByOrder(deliveryData.order);
    if (existingDeliveryForOrder) {
        throw createError(
            ErrorDictionary.RESOURCE_CONFLICT_ERROR.name,
            'La orden ya tiene una entrega asociada',
            ErrorDictionary.RESOURCE_CONFLICT_ERROR.status,
            ErrorDictionary.RESOURCE_CONFLICT_ERROR.code
        );
    }

    if (deliveryData.driver) {
        await this.validateDriver(deliveryData.driver);
    }

    const hasDriver = Boolean(deliveryData.driver);
    let newDeliveryId;
    try {
        await this.runWithOptionalTransaction(async (session) => {
            const newDelivery = await this.deliveryRepository.create({
                order: deliveryData.order,
                driver: deliveryData.driver || null,
                status: hasDriver ? DELIVERY_STATUS.ASSIGNED : DELIVERY_STATUS.PENDING,
                priority: deliveryData.priority || ORDER_PRIORITY.NORMAL,
                assignedAt: hasDriver ? new Date() : null
            }, session ? { session } : {});

            newDeliveryId = newDelivery._id;

            const updatedOrder = await this.orderRepository.update(deliveryData.order, {
                status: hasDriver ? ORDER_STATUS.ASSIGNED : ORDER_STATUS.CREATED,
                delivery: newDelivery._id
            }, session ? { session } : {});

            if (!updatedOrder) {
                throw createError(
                ErrorDictionary.ORDER_NOT_FOUND_ERROR.name,
                ErrorDictionary.ORDER_NOT_FOUND_ERROR.message,
                ErrorDictionary.ORDER_NOT_FOUND_ERROR.status,
                ErrorDictionary.ORDER_NOT_FOUND_ERROR.code
                );
            }
        });
    } catch (error) {
        if (error?.code === 11000 && error?.keyPattern?.order) {
            throw createError(
                ErrorDictionary.RESOURCE_CONFLICT_ERROR.name,
                'La orden ya tiene una entrega asociada',
                ErrorDictionary.RESOURCE_CONFLICT_ERROR.status,
                ErrorDictionary.RESOURCE_CONFLICT_ERROR.code
            );
        }

        throw error;
    }

    return this.deliveryRepository.findById(newDeliveryId);
    }

    async addProof(id, file) {
    if (!file) {
        throw createError(
            ErrorDictionary.MISSING_FILE.name,
            ErrorDictionary.MISSING_FILE.message,
            ErrorDictionary.MISSING_FILE.status,
            ErrorDictionary.MISSING_FILE.code
        );
    }

    const delivery = await this.deliveryRepository.findById(id);
    if (!delivery) {
        throw createError(
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.name,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.message,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.status,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.code
        );
    }

    const proofs = Array.isArray(delivery.proofs) ? [...delivery.proofs] : [];
    proofs.push({
        name: file.originalname,
        reference: file.filename,
        originalName: file.originalname,
        fileName: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        type: 'comprobante',
        uploadedAt: new Date()
    });

    const updatedDelivery = await this.deliveryRepository.updateById(id, { proofs });
    logger.info('Comprobante asociado a la entrega', { deliveryId: id, fileName: file.filename });
    return updatedDelivery;
    }

    async updateDelivery(id, deliveryData) {
    const existingDelivery = await this.deliveryRepository.findById(id);
    if (!existingDelivery) {
        throw createError(
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.name,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.message,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.status,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.code
        );
    }

    const updateData = { ...deliveryData };
    if (Object.prototype.hasOwnProperty.call(updateData, 'driver') && updateData.driver) {
        await this.validateDriver(updateData.driver);
    }

    const currentDriver = existingDelivery.driver?._id?.toString?.() || existingDelivery.driver || null;
    const nextDriver = Object.prototype.hasOwnProperty.call(updateData, 'driver') ? updateData.driver : currentDriver;
    const nextStatus = updateData.status || existingDelivery.status;
    if (updateData.status && !this.isValidStatusTransition(existingDelivery.status, updateData.status)) {
        throw createError(
            ErrorDictionary.BAD_REQUEST_ERROR.name,
            `Transición de estado inválida: ${existingDelivery.status} -> ${updateData.status}`,
            ErrorDictionary.BAD_REQUEST_ERROR.status,
            ErrorDictionary.BAD_REQUEST_ERROR.code
        );
    }

    if (this.requiresAssignedDriver(nextStatus) && !nextDriver) {
        throw createError(
            ErrorDictionary.BAD_REQUEST_ERROR.name,
            'No se puede establecer este estado sin un repartidor asignado',
            ErrorDictionary.BAD_REQUEST_ERROR.status,
            ErrorDictionary.BAD_REQUEST_ERROR.code
        );
    }

    if (updateData.status === DELIVERY_STATUS.DELIVERED && !updateData.deliveredAt) {
        updateData.deliveredAt = new Date();
    }

    const updatedDelivery = await this.deliveryRepository.updateById(id, updateData);
    if (updateData.status && updatedDelivery?.order?._id) {
        await this.orderRepository.update(updatedDelivery.order._id, {
            status: this.mapDeliveryStatusToOrderStatus(updateData.status)
        });
    }

    return updatedDelivery;
    }

    async deleteDelivery(id) {
    const deletedDelivery = await this.deliveryRepository.deleteById(id);
    if (!deletedDelivery) {
        throw createError(
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.name,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.message,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.status,
            ErrorDictionary.DELIVERY_NOT_FOUND_ERROR.code
        );
    }

    return deletedDelivery;
    }

    async validateDriver(driverId) {
    const driver = await this.userRepository.findRawById(driverId);
    if (!driver) {
        throw createError(
        ErrorDictionary.USER_NOT_FOUND_ERROR.name,
        ErrorDictionary.USER_NOT_FOUND_ERROR.message,
        ErrorDictionary.USER_NOT_FOUND_ERROR.status,
        ErrorDictionary.USER_NOT_FOUND_ERROR.code
        );
    }

    if (driver.role !== USER_ROLES.DRIVER) {
        throw createError(
        ErrorDictionary.BAD_REQUEST_ERROR.name,
        'El usuario asignado no tiene rol de repartidor',
        ErrorDictionary.BAD_REQUEST_ERROR.status,
        ErrorDictionary.BAD_REQUEST_ERROR.code
        );
    }
    }

    requiresAssignedDriver(status) {
    return [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.DELIVERED].includes(status);
    }

    mapDeliveryStatusToOrderStatus(deliveryStatus) {
    if (deliveryStatus === DELIVERY_STATUS.PENDING) {
        return ORDER_STATUS.CREATED;
    }

    if (deliveryStatus === DELIVERY_STATUS.ASSIGNED) {
        return ORDER_STATUS.ASSIGNED;
    }

    if (deliveryStatus === DELIVERY_STATUS.IN_TRANSIT) {
        return ORDER_STATUS.IN_TRANSIT;
    }

    return ORDER_STATUS.DELIVERED;
    }

    isValidStatusTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
        return true;
    }

    const allowedTransitions = {
        [DELIVERY_STATUS.PENDING]: [DELIVERY_STATUS.ASSIGNED],
        [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.IN_TRANSIT],
        [DELIVERY_STATUS.IN_TRANSIT]: [DELIVERY_STATUS.DELIVERED],
        [DELIVERY_STATUS.DELIVERED]: []
    };

    return allowedTransitions[currentStatus]?.includes(nextStatus) || false;
    }

    async runWithOptionalTransaction(operation) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
        await operation(session);
        });
    } catch (error) {
        if (this.isTransactionNotSupported(error)) {
        if (config.requireReplicaSetTransactions) {
            throw createError(
            ErrorDictionary.SERVICE_UNAVAILABLE_ERROR.name,
            'Se requiere MongoDB con replica set o mongos para ejecutar transacciones en este entorno',
            ErrorDictionary.SERVICE_UNAVAILABLE_ERROR.status,
            ErrorDictionary.SERVICE_UNAVAILABLE_ERROR.code
            );
        }

        logger.warning('Transacciones no soportadas por MongoDB actual, se ejecuta flujo sin transacción');
        await operation(null);
        return;
        }

        throw error;
    } finally {
        await session.endSession();
    }
    }

    isTransactionNotSupported(error) {
    const message = error?.message || '';
    return error?.code === 20 || message.includes('Transaction numbers are only allowed on a replica set member or mongos');
    }

    buildPagination(query) {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const requestedLimit = Number(query.limit) > 0 ? Number(query.limit) : DEFAULT_LIMIT;
    const limit = Math.min(requestedLimit, MAX_LIMIT);

    return {
        limit,
        skip: (page - 1) * limit
    };
    }
}

export default DeliveryService;