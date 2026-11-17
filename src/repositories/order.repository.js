import Order from "../models/order.model.js";

class OrderRepository{
    async findAll({ filter = {}, pagination = {} } = {}){
        return Order.find(filter).
        populate("customer", "firstName lastName email").
        populate("delivery").
        sort({ createdAt: -1 }).
        skip(Number(pagination.skip) || 0).
        limit(Number(pagination.limit) || 20)
    }

    async findById(id){
        return Order.findById(id).
        populate("customer", "firstName lastName email").
        populate("delivery")
    }

    async create(orderData, options = {}){
        if (options.session) {
            const createdOrders = await Order.create([orderData], options);
            return createdOrders[0];
        }

        return Order.create(orderData)
    }

    async update(id, orderData, options = {}){
        return Order.findByIdAndUpdate(id, orderData, { new: true, runValidators: true, ...options })
    }

    async delete(id){
        return Order.findByIdAndDelete(id);
    }

}

export default OrderRepository