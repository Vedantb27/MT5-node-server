const Payment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID required" });
    }

    // 🔹 Dummy payment check
    const paymentSuccessful = true;

    if (!paymentSuccessful) {
      return res.status(402).json({
        message: "Payment failed, please retry"
      });
    }

    // attach payment info if needed
    req.payment = {
      status: "SUCCESS",
      paymentId
    };

    next(); // ✅ move to next controller

  } catch (err) {
    return res.status(500).json({ message: "Payment validation error" });
  }
};

module.exports = { Payment };
