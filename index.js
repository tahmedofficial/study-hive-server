require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({ origin: ["http://localhost:5173"] }));
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ufkobjs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const database = client.db("studyHiveDB");
        const usersCollection = database.collection("users");
        const courseCollection = database.collection("course");
        const bookedCollection = database.collection("booked");
        const reviewCollection = database.collection("review");
        const notesCollection = database.collection("notes");

        // User related api
        app.get("/users/admin/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === "admin";
            }
            res.send({ admin })
        })

        app.get("/users/tutor/:email", async (req, res) => {
            const emial = req.params.email;
            const query = { email: emial };
            const user = await usersCollection.findOne(query);
            let tutor = false;
            if (user) {
                tutor = user.role === "tutor";
            }
            res.send({ tutor });
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user?.email };
            const isExist = await usersCollection.findOne(query);
            if (isExist) {
                return res.send({ message: "user already exists", insertrdId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // Course related api
        app.get("/courses", async (req, res) => {
            const result = await courseCollection.find().toArray();
            res.send(result);
        })

        app.get("/courses/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await courseCollection.findOne(query);
            res.send(result);
        })

        // booked related api
        app.get("/booked/:email", async (req, res) => {
            const email = req.params.email;
            const result = await bookedCollection.aggregate([
                {
                    $match: { studentEmail: email }
                },
                {
                    $lookup: {
                        from: 'course',
                        let: { sessionId: '$sessionId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [{ $toString: '$_id' }, { $toString: '$$sessionId' }]
                                    }
                                }
                            }
                        ],
                        as: 'sessionInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$sessionInfo',
                        preserveNullAndEmptyArrays: true
                    }
                }

            ]).toArray();
            res.send([result])
        })

        app.post("/booked", async (req, res) => {
            const booking = req.body;
            // const query = { studentEmail: booking.studentEmail };
            // const booked = await bookedCollection.find(query).toArray();
            // const isExist = booked.some(booke => booke.sessionId === booking.sessionId);
            // if (isExist) {
            //     return res.send({ insertedId: null })
            // }
            const result = await bookedCollection.insertOne(booking);
            res.send(result);
        })

        // Review related api
        app.post("/review", async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        // Notes related api
        app.get("/notes/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await notesCollection.find(query).toArray();
            res.send(result);
        })

        app.post("/notes", async (req, res) => {
            const note = req.body;
            const result = await notesCollection.insertOne(note);
            res.send(result);
        })

        // Tutor related api
        app.get("/tutors", async (req, res) => {
            const query = { role: "tutor" };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // Stripe payment intent
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            })
            res.send({ clientSecret: paymentIntent.client_secret, })

        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Server is running");
})

app.listen(port, () => {
    console.log(`Server is running on ${port}`);
})