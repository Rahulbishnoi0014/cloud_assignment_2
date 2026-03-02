require("dotenv").config();
const express = require("express");
const multer = require("multer");
const sql = require("mssql");
const { BlobServiceClient } = require("@azure/storage-blob");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// Multer configuration
const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
});

// SQL Configuration
const dbConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: true,
  },
};

// Blob Configuration
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME
);



const appInsights = require("applicationinsights");

appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true)
  .start();

  

// Home route - list products
app.get("/", async (req, res) => {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query("SELECT * FROM products ORDER BY created_at DESC");
    res.render("index", { products: result.recordset });
  } catch (err) {
    res.send("Error fetching products");
  }
});



// Add product form
app.get("/add", (req, res) => {
  res.render("add", { error: null });
});

// Handle add product
app.post("/add", upload.single("image"), async (req, res) => {
  const { name, price, description } = req.body;
  const file = req.file;

  if (!name || price <= 0 || !file) {
    return res.render("add", { error: "Invalid input data" });
  }

  try {
    const blobName = Date.now() + "-" + file.originalname;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer);

    const imageUrl = blockBlobClient.url;

    await sql.connect(dbConfig);
    await sql.query`
      INSERT INTO products (name, price, description, image_url)
      VALUES (${name}, ${price}, ${description}, ${imageUrl})
    `;

    res.redirect("/");
  } catch (err) {
    res.send("Error adding product");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});