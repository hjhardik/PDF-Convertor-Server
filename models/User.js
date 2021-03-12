const mongoose = require("mongoose");
//creating user schema to store user info in database
const userSchema = new mongoose.Schema({
  email:{
    type: String,
    required: true,
  },
  password:{
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

//creating model
const User = mongoose.model("User", userSchema);
//exporting model
module.exports = User;
