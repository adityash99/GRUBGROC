import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from 'dotenv';

dotenv.config();
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID);
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_bPYoBSjt6DkPpb',  // Enter your Razorpay Key here
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'jSTWg1jDK06fmJl91PXZUtme',  // Enter your Razorpay Secret here
});

// Create Razorpay order (but don't create a DB order yet)
export const createOrder = async (req, reply) => {
  try {
    const { items, branch, totalPrice } = req.body;
    const { userId } = req.user;

    // Generate a Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalPrice * 100, // Amount in paise
      currency: "INR",
      receipt: `order_${new Date().getTime()}`,
      payment_capture: 1, // 1 for automatic capture
    });

    // Return the Razorpay order details (but don't save to DB yet)
    return reply.status(201).send({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
    });
  } catch (error) {
    console.error("Failed to create Razorpay order", error);
    return reply.status(500).send({ message: "Failed to create order" });
  }
};

// Confirm the payment and create the actual order in the database
export const confirmOrder = async (req, reply) => {
  try {
    const { userId } = req.user;
    const { items, branch, totalPrice } = req.body;

    const customerData = await Customer.findById(userId);
    console.log(customerData, "check cusomer datat here");
    const brachData = await Branch.findById(branch);

    if (!customerData) {
      return reply.status(404).send({ message: "Customer not found" });
    }

    const newOrder = new Order({
      customer: userId,
      items: items.map((item) => ({
        id: item.id,
        item: item.item,
        count: item.count,
      })),
      branch,
      totalPrice,
      deliveryLocation: {
        latitude: customerData.liveLocation.latitude,
        longitude: customerData.liveLocation.longitude,
        address: "No address available",
      },
      pickupLocation: {
        latitude: brachData.location.latitude,
        longitude: brachData.location.longitude,
        address: brachData.address || "No address available",
      },
    });

    const savedOrder = await newOrder.save();
    return reply.status(201).send(savedOrder);
  } catch (err) {
    console.log(err);
    return reply.status(500).send({ message: "Failed to create order", error });
  }
};

export const confirmingOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.user;
    const { deliveryPersonLocation } = req.body;

    const deliveryPerson = await DeliveryPartner.findById(userId);
    if (!deliveryPerson) {
      return reply.status(404).send({ message: "Delivery Person not found" });
    }
    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (order.status !== "available") {
      return reply.status(400).send({ message: "Order is not available" });
    }
    order.status = "confirmed";

    order.deliveryPartner = userId;
    order.deliveryPersonLocation = {
      latitude: deliveryPersonLocation?.latitude,
      longitude: deliveryPersonLocation?.longitude,
      address: deliveryPersonLocation.address || "",
    };

    req.server.io.to(orderId).emit("orderConfirmed", order);

    await order.save();

    return reply.send(order);
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Failed to confirm order", error });
  }
};


// Update the order status (e.g., for delivery updates)
export const updateOrderStatus = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryPersonLocation } = req.body;

    const { userId } = req.user;

    const deliveryPerson = await DeliveryPartner.findById(userId);
    if (!deliveryPerson) {
      return reply.status(404).send({ message: "Delivery Person not found" });
    }

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (["cancelled", "delivered"].includes(order.status)) {
      return reply.status(400).send({ message: "Order cannot be updated" });
    }

    if (order.deliveryPartner.toString() !== userId) {
      return reply.status(403).send({ message: "Unauthorized" });
    }

    order.status = status;
    order.deliveryPersonLocation = deliveryPersonLocation;
    await order.save();

    req.server.io.to(orderId).emit("liveTrackingUpdates", order);

    return reply.send(order);
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Failed to update order status", error });
  }
};

// Retrieve all orders based on query parameters
export const getOrders = async (req, reply) => {
  try {
    const { status, customerId, deliveryPartnerId, branchId } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }
    if (customerId) {
      query.customer = customerId;
    }
    if (deliveryPartnerId) {
      query.deliveryPartner = deliveryPartnerId;
      query.branch = branchId;
    }

    const orders = await Order.find(query).populate(
      "customer branch items.item deliveryPartner"
    );

    return reply.send(orders);
  } catch (error) {
    console.error("Failed to retrieve orders", error);
    return reply
      .status(500)
      .send({ message: "Failed to retrieve orders", error });
  }
};

// Retrieve order by ID
export const getOrderById = async (req, reply) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate(
      "customer branch items.item deliveryPartner"
    );

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    return reply.send(order);
  } catch (error) {
    console.error("Failed to retrieve order", error);
    return reply
      .status(500)
      .send({ message: "Failed to retrieve order", error });
  }
};