//import all required modules
const express = require("express");
const mongoose = require("mongoose"); //for mongodb database
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
var qs = require('qs');

const app = express();

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
const Annotation = require("./models/Annotation");

//require editing functions
const reorderPage = require('./reorderPage.js');
const deletePage = require('./deletePage.js');
const splitFile = require('./splitFile.js');
const mergeFile = require('./mergeFiles')

//require all editing functions
const clientID = require('./config/signApi').clientID
const clientSecret = require('./config/signApi').clientSecret
const redirectUrl = require('./config/signApi').redirectURL


//findUser
const findUser = async ({email, password}) => {
  let user = await User.find({email, password})
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

//contracts
app.post('/contracts', async (req,res) => {
  //let email = req.body;
  let contracts = fs.readdirSync("./uploads")
  res.send(
  contracts
  )  
});


//reorder 
app.post('/editcontract/reorderDelete', async(req,res) => {
  let {selectedFiles, SP, EP, id} = req.body;
  let fileName = selectedFiles;

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

  let {contract, email, code, api_access_point } = req.body; 
   //NOW SEND POST REQ TO TOKEN ENDPOINT
  if (code !== null && code !== undefined) {  
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
    .then(async function (response) {
      let agreementId = response.data.id
      var cnfg = {
        method: 'get',
        url: `${api_access_point}api/rest/v6/agreements/${agreementId}/signingUrls`,
        headers: { 
          'Authorization': `Bearer ${access_token}`
        }
      };

      await axios(cnfg)
      .then(async function (response) {
        let signingUrl = response.data.signingUrlSetInfos[0].signingUrls[0].esignUrl;
        res.json({
          success: true,
          msg:"Updated agreement id",
          url:signingUrl
        });

      }).catch(e => {
        console.log(e)
      axios(cnfg)
      .then(async function (response) {
        let signingUrl = response.data.signingUrlSetInfos[0].signingUrls[0].esignUrl;
        res.json({
          success: true,
          msg:"Updated agreement id",
          url: signingUrl
        });

      }).catch(e =>{
        console.log(e)
        res.json({
          success: false,
          msg: "Error occured while creating signing url."
        })
      })
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
    let url = `https://secure.na1.adobesign.com/public/oauth?redirect_uri=${redirectUrl}&response_type=code&client_id=${clientID}&scope=user_login:self+agreement_read:self+agreement_write:self+agreement_send:self&state=abcdg`;
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

//find annotations present in the contract
app.post("/copycontract/annotations/find", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let reqFile = req.body.fileId;
  if (reqFile == "" || reqFile === undefined) {
    res.send(null);
  } else {
    //finds all annotations with same fileId
    Annotation.find({ fileId: reqFile })
      .select({ _id: 0, data: 1 })
      .exec((err, annos) => {
        if (!err) {
          res.send(annos);
        } else {
          res.send('cannot find annotation with file id')
        }
      });
  }
});

//add annotations route
app.post("/copycontract/annotations/add", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let data = req.body.data;
  let fileName = req.body.fileId;
  if (data == "" || fileName == "" || data == undefined) {
    res.send(null);
  } else {
    let id = data.id;
    Annotation.findOne({ id: id, fileId: fileName }).then((anno) => {
      //checks if already not present, then creates one
      if (!anno) {
        let ano = new Annotation({
          id: id,
          fileId: fileName,
          data: data,
        });
        ano.save();
      }
    });
    res.send('success');
  }
});
//update annotations route
app.post("/copycontract/annotations/update", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let data = req.body.data;
  let fileName = req.body.fileId;
  let id = data.id;
  //find annos from DB by fileId and then updates it
  Annotation.findOneAndUpdate(
    { id: id, fileId: fileName },
    { "data.bodyValue": data.bodyValue },
    (err) => {
      if (err) {
        console.log(err)
      }
    }
  );
  res.sendStatus(200);
});

//delete annonations route
app.post("/copycontract/annotations/delete", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let data = req.body.data;
  let fileName = req.body.fileId;
  let id = data.id;
  //finds annos by _id and then deletes it from DB
  await Annotation.deleteOne({ id: id, fileId: fileName }, (err) => {
    if (err) {
      console.log(err)
    }
  });
  res.sendStatus(200);
});

//port
//eslint-disable-next-line
const PORT = process.env.PORT || 8080;
//start server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
