const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config(); // Load environment variables

async function main() {
  try {
    await mongoose.connect("mongodb://localhost:27017/mydatabase");
    console.log("Connected to MongoDB");

    const userSchema = new mongoose.Schema({
      name: String,
      email: String
    });

    const User = mongoose.model("User", userSchema);

    // Fetch all users from MongoDB
    const users = await User.find({}, { name: 1, email: 1, _id: 0 });

    if (users.length === 0) {
      console.log("No users found.");
      return;
    }

    console.log("Sending emails to:", users.map(user => user.email));

    const appPassword = process.env.EMAIL_PASS;
    const emailUser = process.env.EMAIL_USER;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: appPassword
      }
    });

    // Loop through each user and send a personalized email
    for (const user of users) {
      const mailOptions = {
        from: emailUser,
        to: user.email,
        subject: "Personalized Email from Node.js",
        html: `<h1>Hi ${user.name},</h1><p>That was easy!</p>`
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${user.name} (${user.email}): ${info.response}`);
      } catch (error) {
        console.error(`Error sending to ${user.email}:`, error);
      }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    mongoose.connection.close();
  }
}

main();
