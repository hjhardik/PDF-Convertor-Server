//If want to use your own MONGODB database update the db password as follows:
//dbPassword = 'mongodb+srv://YOUR_USERNAME_HERE:'+ encodeURIComponent('YOUR_PASSWORD_HERE') + '@CLUSTER_NAME_HERE.mongodb.net/test?retryWrites=true';
let dbPassword =
"mongodb+srv://admin:admin@cluster0.4iglj.mongodb.net/test"
//export the database URI
module.exports = {
  mongoURI: dbPassword,
};