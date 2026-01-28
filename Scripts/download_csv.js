const fs = require('fs');
const https = require('https');

const file = fs.createWriteStream("indian_medicines.csv");
const url = "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv";

https.get(url, function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close(() => {
        console.log("Download completed.");
    });
  });
}).on('error', function(err) { 
  fs.unlink("indian_medicines.csv"); 
  console.error("Error downloading:", err.message);
});
