const PDFToolsSdk = require('@adobe/documentservices-pdftools-node-sdk');

module.exports = async function mergeFile(filesToBeMerged, mergedFileName){
try {
  // Initial setup, create credentials instance.
  const credentials = PDFToolsSdk.Credentials
      .serviceAccountCredentialsBuilder()
      .fromFile("pdftools-api-credentials.json")
      .build();

  // Create an ExecutionContext using credentials and create a new operation instance.
  const executionContext = PDFToolsSdk.ExecutionContext.create(credentials),
      combineFilesOperation = PDFToolsSdk.CombineFiles.Operation.createNew();

  // Set operation input from a source file.
  for(let i=0; i< filesToBeMerged.length; i++){
    combineFilesOperation.addInput(PDFToolsSdk.FileRef.createFromLocalFile(`uploads/${filesToBeMerged[i]}`))
  }
  // Execute the operation and Save the result to the specified location.
  combineFilesOperation.execute(executionContext)
      .then(result => {
            result.saveAsFile(`uploads/${mergedFileName}.pdf`)
            return ({
                success: true,
                fileName: `${mergedFileName}.pdf`
            })  
      }).catch(err => {
          if (err instanceof PDFToolsSdk.Error.ServiceApiError
              || err instanceof PDFToolsSdk.Error.ServiceUsageError) {
              console.log('Exception encountered while executing operation', err);
          } else {
              console.log('Exception encountered while executing operation', err);
          }
          return ({
              success: false,
              msg: "Server err ocurred"
          })
      });
} catch (err) {
  console.log('Exception encountered while executing operation', err);
  return ({
    success: false,
    msg: "Server error occured"
})
}
}