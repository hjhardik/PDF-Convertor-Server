const PDFToolsSdk = require('@adobe/documentservices-pdftools-node-sdk');

 const getPageRanges = (startingPage, endingPage) => {
   // Specify pages ranges.
   const pageRanges = new PDFToolsSdk.PageRanges();
   // Add page 1.
   if(startingPage ==endingPage) pageRanges.addSinglePage(startingPage);
    else pageRanges.addPageRange(startingPage, endingPage);
   return pageRanges;
 };
 
 module.exports = async function splitFile(baseFile, startingPage, endingPage){
 let saved;
    try {
   // Initial setup, create credentials instance.
   const credentials =  PDFToolsSdk.Credentials
       .serviceAccountCredentialsBuilder()
       .fromFile("pdftools-api-credentials.json")
       .build();

   // Create an ExecutionContext using credentials
   const executionContext = PDFToolsSdk.ExecutionContext.create(credentials);

   // Create a new operation instance.
   const splitPDFOperation = PDFToolsSdk.SplitPDF.Operation.createNew(),
       input = PDFToolsSdk.FileRef.createFromLocalFile(
           `uploads/${baseFile}`,
           PDFToolsSdk.SplitPDF.SupportedSourceFormat.pdf
       );
   // Set operation input from a source file.
   splitPDFOperation.setInput(input);

   // Set the page ranges where each page range corresponds to a single output file.
   const pageRanges = getPageRanges(startingPage, endingPage);
   splitPDFOperation.setPageRanges(pageRanges);

   // Execute the operation and Save the result to the specified location.
   saved = await splitPDFOperation.execute(executionContext)
       .then(async result => {
           let savedFiles = [];
           for(let i = 0; i < result.length; i++){
               let savedFile = `${baseFile.replace(".pdf","")}_${i}-${Date.now()}.pdf`
               await result[i].saveAsFile(`uploads/${savedFile}`)
               await savedFiles.push(savedFile)
           }
           return ({
            success: true,
            savedFiles: savedFiles
        })
       })
       .catch(err => {
           if(err instanceof PDFToolsSdk.Error.ServiceApiError
               || err instanceof PDFToolsSdk.Error.ServiceUsageError) {
               console.log('Exception encountered while executing operation', err);
           } else {
               console.log('Exception encountered while executing operation', err);
           }
           return ({
               success: false
           })
       });
 } catch (err) {
   console.log('Exception encountered while executing operation', err);
   return ({
    success: false
})
 }
 return saved
}    