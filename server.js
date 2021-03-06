//import all required modules
const express = require("express");
const mongoose = require("mongoose"); //for mongodb database
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
var qs = require('qs');
const pdf = require('pdf-page-counter');

//creating app
const app = express();

//middlewares
app.use(express.urlencoded({ extended: true}));
app.use(express.json());
app.use(cors({origin: '*'}));

//DB Config
const db = require("./config/keys").mongoURI;

// Connect to MongoDB
mongoose
  .connect(db, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

  //upload functionalities
  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname.replace(".pdf","") + '-' + Date.now()+ ".pdf")
  }
})

  var upload = multer({ storage: storage }).single('file')
  // express route where we receive files from the client
  // passing multer middleware
  app.post('/files', (req, res) => {  
   // all other values passed from the client, like name, etc..
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
          return res.status(500).json(err)
      }
    return res.sendStatus(200)
    }
  );
});    


//models
const User = require("./models/User");
//const pdfContract = require("./models/pdfContract");

//require editing functions
const reorderPage = require('./OperationReorder.js');
const deletePage = require('./OperationDelete.js');
const splitFile = require('./OperationSplit.js');
const mergeFile = require('./OperationMerge')

//require all editing functions
const clientID = require('./config/signApi').clientID
const clientSecret = require('./config/signApi').clientSecret
const redirectUrl = require('./config/signApi').redirectURL


//findUser
const findUser = async (email, password) => {
  let user = await User.findOne({email, password})
  if(user){
    return user
  }else{
    return null
  }
}

//register user
const registerUser = async (email, password) => {
  let alreadyUser = await User.findOne({email})
  if(alreadyUser){
      return null
    }else{
      const newUser = await new User({
        email,
        password,
      });
      return await newUser.save()
      }
  }

//find all users
const findAllUsers = async () => {
  return await User.find({},{email:1})
}

// Routes
//login
app.post('/login', async (req,res)=>{
  let {email, password} = req.body;
  let user = await findUser(email.trim(), password)
  if(user === null){
    res.json({
      success: false,
      msg: "Account not found. Please enter correct credentials.",
      token: null,
      email:null
    });
  }else{
    res.json({
      success: true,
      msg: "login successful",
      token: "loginToken",
      email: email,
    });
  }  
})

//register
app.post('/register', async (req,res)=>{
  let {email, password} = req.body;
  let user = await registerUser(email.trim(), password)
  if (user == null){
    res.json({
      success: false,
      msg: "Email already exists. Please use different user name.",
      token: null,
      email:null
    });
  }else{
    res.json({
      success: true,
      msg: "login successful",
      token: "loginToken",
      email: email,
    });
  }
});

const getNumPages = (filePath) => {
  let dataBuffer = fs.readFileSync(filePath);
  let totalPages = 0
  totalPages = pdf(dataBuffer)
  .then((data) => ( 
    Promise.resolve(data.numpages)
  ))
  return totalPages
}

//contracts
app.post('/contracts', async (req,res) => {
  //let email = req.body;
  let contracts = fs.readdirSync("./uploads");
  res.send(
  contracts
  )  
});


//reorder 
app.post('/editcontract/reorderDelete', async(req,res) => {
  let {selectedFiles, SP, EP, id} = req.body;
  let fileName = selectedFiles;
  let num_pages = await getNumPages(`./uploads/${fileName}`);
  if(SP > num_pages){
    res.json({
      success: false,
      msg:'Starting page cannot be greater than total no of pages',
    })
  }else if(EP > num_pages){
    res.json({
      success: false,
      msg:'Ending page cannot be greater than total no. of pages',
    })
  }
  if(id === 0){
    let status = await deletePage(fileName, Number(SP), Number(EP))
    if(status){
      res.json({
        success: true,
        fileName: fileName,
      })
    }else{
      res.json({
        success: false,
        msg:'Cannot reorder specified pages.',
      })
    }
  }else if(id === 1){
    let status = await reorderPage(fileName, Number(SP), Number(EP));
    if(status){
        res.json({
          success: true,
          fileName: fileName,
        })
    }else{
      res.json({
        success: false,
        msg:'Cannot reorder specified pages.',
      })
    }
  }else{
    let status = await splitFile(fileName, Number(SP), Number(EP));
    if(status.success){
        res.json({
          success: true,
          fileName: status.savedFiles,
        })
    }else{
      res.json({
        success: false,
        msg:'Cannot split file. Try again later.',
      })
    }
  }
}
);


//sign api redirection
app.post('/signauth/redirect', async (req,res) => {

  let {contract, email, code, state, api_access_point } = req.body; 
   //NOW SEND POST REQ TO TOKEN ENDPOINT
  if (code !== null && code !== undefined) {
    contract = state.split("__")[0]
    email = state.split("__")[1]   
  var data = qs.stringify({
    'code': code,
    'client_id': clientID,
    'client_secret': clientSecret,
    'redirect_uri': redirectUrl,
    'grant_type': 'authorization_code', 
  });
  var config = {
    method: 'post',
    url: "https://api.adobesign.com/oauth/token",
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data : data
  };

  let fetchedData = await axios(config)
    .then(function (response) {
      return (JSON.stringify(response.data));
    })
    .catch(function (error) {
      res.json({
        success: false,
        msg: error
      })
    });
    
  
  let access_token = JSON.parse(fetchedData).access_token
  //let refresh_token = JSON.parse(fetchedData).refresh_token

  if(access_token == undefined || access_token==null){
    res.json({
      success: false,
      msg: 'Could not generate access token.'
    })
  }

  data = new FormData();
  try {
    data.append('File', fs.createReadStream(`./uploads/${contract}`));
  } catch (error) {
    res.json({
      success: false,
      msg: "The created contract file was deleted due to free tier server usage."
    })
  }
  
  config = {
    method: 'post',
    url: `${api_access_point}api/rest/v6/transientDocuments`,
    headers: { 
      'Authorization': `Bearer ${access_token}`, 
      ...data.getHeaders()
    },
    data : data
  };

  axios(config)
  .then(function (response) {
    let transientDocumentId = response.data.transientDocumentId;

    var newData = JSON.stringify({"fileInfos":[{"transientDocumentId":`${transientDocumentId}`}],"name":`${contract}`,"participantSetsInfo":[{"memberInfos":[{"email":`${email}`}],"order":1,"role":"SIGNER"}],"signatureType":"ESIGN","state":"IN_PROCESS"});

    var newConfig = {
      method: 'post',
      url: `${api_access_point}api/rest/v6/agreements`,
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${access_token}`
      },
      data : newData
    };
    axios(newConfig)
    .then(() => {
      res.json({
        success: true,
        msg: "Successful"
      })
      }).catch(e =>{
        console.log(e)
        res.json({
          success: false,
          msg: "Error occured while creating signing url."
    })
})
})
  .catch(e => {
    console.log(e);
    res.json({
      success: false,
      msg: "Error occured while creating agreement. Please try again."
    })
  })
  }else{
    let url = `https://secure.na1.adobesign.com/public/oauth?redirect_uri=${redirectUrl}&response_type=code&client_id=${clientID}&scope=user_login:self+agreement_read:self+agreement_write:self+agreement_send:self&state=${contract}__${email}`;
    res.json({
      success: true,
      data: url,
    });
  }
})

//find all the other members present
app.post('/findusers', async (req,res) => {
  let email = req.body.email;
  let candidates = await findAllUsers()
  let candidateNames=[];
  candidates.forEach((candidate)=>{
    if(candidate.email !== email) candidateNames.push(candidate.email)
  })
  res.send(
    candidateNames 
  )
})

//create draft route
app.post('/mergefiles', async (req,  res) => {
  let {selectedFiles, mergedFileName} = req.body;
  if(fs.existsSync(`uploads/${mergedFileName}.pdf`)){
    res.json({
      success: false,
      msg: "File with same name already exists",
    })
  }else{
    let stat = await mergeFile(selectedFiles, mergedFileName);
    if(stat.success){
      res.json({
        success: true,
        fileName: `${mergedFileName}.pdf`
      })
  }else{
    res.json({
      success: false,
      msg: stat.msg 
    })
  }}    
});

// PDF LOCATION
app.get('/viewpdf/:pdfLocation', (req,res)=>{
  var tempFile=`./uploads/${req.params.pdfLocation}`;
  fs.readFile(tempFile, function (err,data){
     res.contentType("application/pdf");
     res.send(data);
  })
});

//port
//eslint-disable-next-line
const PORT = process.env.PORT || 8080;
//start server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
