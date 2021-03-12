const mongoose = require("mongoose");
const pdfContractSchema = new mongoose.Schema({
  location:{
    type: String,
    required:true,
  },
  creator: {
    type: String,
    required: true,
  },
  members:{
    type: Array,
    required: true,
  },
  status: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

//creating model
const pdfContract = mongoose.model("pdfContract", pdfContractSchema);
//exporting model
module.exports = pdfContract;
