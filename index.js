const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
dotenv.config();
const uri = process.env.MONGODB_URI;

const Port = process.env.PORT;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("ideavault");
    const ideaCollection = db.collection("ideas");

    app.post("/idea", async (req, res) => {
      const ideaData = {
        ...req.body,
        createdAt: new Date(),
      };

      const result = await ideaCollection.insertOne(ideaData);

      res.send(result);
    });

    app.get("/idea", async (req, res) => {
      try {
        const { search, category, sort } = req.query;

        let query = {};

        // Search by title
        if (search) {
          query.ideaTitle = {
            $regex: search,
            $options: "i",
          };
        }

        // Filter by category
        if (category && category !== "all") {
          query.category = category;
        }

        // Sorting
        let sortOption = {
          createdAt: -1,
        };

        if (sort === "oldest") {
          sortOption = {
            createdAt: 1,
          };
        }

        const result = await ideaCollection
          .find(query)
          .sort(sortOption)
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/trending-ideas", async (req, res) => {
      const result = await ideaCollection
        .find()
        .sort({ createdAt: -1 }) 
        .limit(6)
        .toArray();

      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running fine");
});

app.listen(Port, () => {
  console.log(`server is running on ${Port}`);
});
