import Delivery from '../models/delivery.model.js';

class DeliveryRepository {
    async findAll({ filter = {}, pagination = {} } = {}) {
    return Delivery.find(filter)
        .populate('order')
        .populate('driver', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(Number(pagination.skip) || 0)
        .limit(Number(pagination.limit) || 20);
    }

    async findById(id) {
    return Delivery.findById(id)
        .populate('order')
        .populate('driver', 'firstName lastName email role');
    }

    async findByOrder(orderId) {
    return Delivery.findOne({ order: orderId })
        .populate('order')
        .populate('driver', 'firstName lastName email role');
    }

    async create(deliveryData, options = {}) {
    if (options.session) {
        const createdDeliveries = await Delivery.create([deliveryData], options);
        return createdDeliveries[0];
    }

    return Delivery.create(deliveryData);
    }

    async updateById(id, updateData) {
    return Delivery.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
        .populate('order')
        .populate('driver', 'firstName lastName email role');
    }

    async deleteById(id) {
    return Delivery.findByIdAndDelete(id);
    }
}

export default DeliveryRepository;