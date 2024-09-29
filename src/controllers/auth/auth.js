import { Customer, DeliveryPartner } from "../../models/user.js";
import jwt from "jsonwebtoken";

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

export const loginCustomer = async (req, reply) => {
  try {
    const { phone } = req.body;
    let customer = await Customer.findOne({ phone });

    if (!customer) {
      customer = new Customer({
        phone,
        role: "Customer",
        isActivated: true,
        latitude:13.3524,
        longitude:74.7868,
        address: "heybaby"
      });

      await customer.save();
    }

    const { accessToken, refreshToken } = generateTokens(customer);

    return reply.send({
      message: customer ? "Login Successful" : "Cusomer created and logged in ",
      accessToken,
      refreshToken,
      customer,
    });
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

////
// In auth.js (or customer.js if you decide to create a separate file)
/*
export const updateCustomerAddress = async (req, reply) => {
  try {
    const { phone, newAddress } = req.body; // Get phone and new address from the request body

    // Find the customer by phone number
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return reply.status(404).send({ success: false, message: 'Customer not found' });
    }

    // Update the address
    customer.address = newAddress;
    await customer.save();

    // Send success response
    reply.send({ success: true, message: 'Address updated successfully' });
  } catch (error) {
    console.error('Error updating address:', error);
    reply.status(500).send({ success: false, message: 'Failed to update address' });
  }
}; 
*/

export const updateCustomerAddress = async (req, reply) => {
  try {
    const { phone, newAddress } = req.body; // Get phone and new address from the request body

    // Find the customer by phone number
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      // If the customer doesn't exist, send a 404 response immediately
      return reply.status(404).send({ success: false, message: 'Customer not found' });
    }

    // Update the address and save the document
    customer.address = newAddress;
    const updatedCustomer = await customer.save();

    // Check if the customer document was updated successfully
    if (!updatedCustomer) {
      // If there was an issue with saving the updated document, send a 500 response
      return reply.status(500).send({ success: false, message: 'Failed to update address' });
    }

    // Send success response if everything went well
    reply.send({ success: true, message: 'Address updated successfully' });
  } catch (error) {
    console.error('Error updating address:', error);
    reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};










// Assuming you're using Fastify or Express.js
export const updateOrderFields = async (req, reply) => {
  try {
    const { orderId } = req.body; // Get the orderId from the request body

    // Find the order by its current ID
    const order = await Order.findOne({ _id: orderId });

    if (!order) {
      return reply.status(404).send({ success: false, message: 'Order not found' });
    }

    // Update the orderId and customerName to "0"
    order.orderId = "0"; // Changing orderId to "0" (string format based on your requirement)
    order.customerName = "0"; // Changing customerName to "0"

    await order.save(); // Save the updated order

    // Send success response
    reply.send({ success: true, message: 'Order fields updated successfully', order });
  } catch (error) {
    console.error('Error updating order fields:', error);
    reply.status(500).send({ success: false, message: 'Failed to update order fields' });
  }
};








  


export const loginDeliveryPartner = async (req, reply) => {
  try {
    const { email, password } = req.body;
    const deliveryPartner = await DeliveryPartner.findOne({ email });

    if (!deliveryPartner) {
      return reply.status(404).send({ message: "Delivery Partner not found" });
    }

    const isMatch = password === deliveryPartner.password;

    if (!isMatch) {
      return reply.status(400).send({ message: "Invalid Credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(deliveryPartner);

    return reply.send({
      message: "Login Successful",
      accessToken,
      refreshToken,
      deliveryPartner,
    });
  } catch (error) {
    return reply.status(500).send({ message: "An errro occurred", error });
  }
};

export const refreshToken = async (req, reply) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return reply.status(401).send({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    let user;

    if (decoded.role === "Customer") {
      user = await Customer.findById(decoded.userId);
    } else if (decoded.role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(decoded.userId);
    } else {
      return reply.status(403).send({ message: "Invalid Role" });
    }

    if (!user) {
      return reply.status(403).send({ message: "Invalid refresh token" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    return reply.send({
      message: "Token Refreshed",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return reply.status(403).send({ message: "Invalid Refresh Token" });
  }
};

export const fetchUser = async (req, reply) => {
  try {
    const { userId, role } = req.user;
    let user;

    if (role === "Customer") {
      user = await Customer.findById(userId);
    } else if (role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(userId);
    } else {
      return reply.status(403).send({ message: "Invalid Role" });
    }

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    return reply.send({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};


