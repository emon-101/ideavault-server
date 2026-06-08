const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async(req, res, next) => {
  const authHeader = req?.headers.authorization
  if(!authHeader) {
    return res.status(401).json({message: "Unauthorized"});
  }
  const token = authHeader.split(" ")[1]
  if(!token) {
    return res.status(401).json({message: "Unauthorized"});
  }
  // console.log(token);

  try{
    const{payload} = await jwtVerify(token, JWKS)
    console.log(payload);
    next();
  } catch(error) {
    return res.status(403).json({message: "Forbidden"})
  }
}

async function run() {
  try {
    // await client.connect();

    const db = client.db("ideavault");
    const ideaCollection = db.collection("ideas");
    const commentCollection = db.collection("comments");
    const usersCollection = db.collection("user");

    // this for saving comments
    app.post("/comments", async (req, res) => {
      try {
        const commentData = {
          ...req.body,
          createdAt: new Date(),
        };

        const result = await commentCollection.insertOne(commentData);

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/comments/:ideaId", async (req, res) => {
      try {
        const { ideaId } = req.params;

        const result = await commentCollection
          .find({ ideaId })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.patch("/comments/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await commentCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              comment: req.body.comment,
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.delete("/comments/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await commentCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/my-interactions/:userId",verifyToken, async (req, res) => {
      const { userId } = req.params;

      const comments = await commentCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      const result = await Promise.all(
        comments.map(async (comment) => {
          const idea = await ideaCollection.findOne({
            _id: new ObjectId(comment.ideaId),
          });

          return {
            ...comment,
            ideaTitle: idea?.ideaTitle,
          };
        }),
      );

      res.send(result);
    });

    // this is for my ideas
    app.get("/my-ideas/:userId",verifyToken, async (req, res) => {
      const { userId } = req.params;

      const ideas = await ideaCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(ideas);
    });
    // This for idea collection
    app.post("/idea", verifyToken, async (req, res) => {
      const ideaData = {
        ...req.body,
        createdAt: new Date(),
      };

      const result = await ideaCollection.insertOne(ideaData);

      res.send(result);
    });

    app.patch("/idea/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const result = await ideaCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedData,
        },
      );

      res.send(result);
    });

    app.delete("/idea/:id", async (req, res) => {
      const { id } = req.params;

      const result = await ideaCollection.deleteOne({
        _id: new ObjectId(id),
      });

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

    app.get("/idea/:id",verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await ideaCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // This is for users
    app.patch("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { name, image } = req.body;

        const result = await usersCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              name,
              image,
              updatedAt: new Date(),
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    // await client.db("admin").command({ ping: 1 });
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
