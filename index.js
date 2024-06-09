require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://study-hive-6e0e8.firebaseapp.com",
        "https://study-hive-6e0e8.web.app"
    ]
}));
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
        // await client.connect();

        const database = client.db("studyHiveDB");
        const usersCollection = database.collection("users");
        const courseCollection = database.collection("course");
        const bookedCollection = database.collection("booked");
        const reviewCollection = database.collection("review");
        const notesCollection = database.collection("notes");
        const materialsCollection = database.collection("materials");

        // jwt related api
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_TOKEN, { expiresIn: "1h" });
            res.send({ token });
        })

        // Middlewares
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "Unauthorized access" });
            }
            const token = req.headers.authorization.split(" ")[1];
            jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: "Unauthorized access" });
                }
                req.decoded = decoded;
                next();
            })
        }

        // User related api
        app.get("/users", verifyToken, async (req, res) => {
            try {
                const filter = req.query.search;
                const query = {
                    $or: [
                        { name: { $regex: filter, $options: "i" } },
                        { email: { $regex: filter, $options: "i" } },
                    ]
                };
                const result = await usersCollection.find(query).toArray();
                res.send(result);
            }
            catch {
                res.send([]);
            }
        })

        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === "admin";
            }
            res.send({ admin })
        })

        app.get("/users/tutor/:email", verifyToken, async (req, res) => {
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

        app.patch("/users/:id", async (req, res) => {
            const id = req.params.id;
            const { role } = req.body;
            const query = { _id: new ObjectId(id) };
            const updateRole = {
                $set: {
                    role: role
                }
            }
            const result = await usersCollection.updateOne(query, updateRole);
            res.send(result);
        })

        // Course related api
        app.get("/courses", async (req, res) => {
            const query = { status: "approved" };
            const result = await courseCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/sessions", verifyToken, async (req, res) => {
            const query = { status: "pending" };
            const result = await courseCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/sessions/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { status: "approved", tutorEmail: email };
            const result = await courseCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/rejSessions/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { status: "rejected", tutorEmail: email };
            const result = await courseCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/courses/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await courseCollection.findOne(query);
            res.send(result);
        })

        app.post("/courses", verifyToken, async (req, res) => {
            const session = req.body;
            const result = await courseCollection.insertOne(session);
            res.send(result);
        })

        app.patch("/courses/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;

            if (data.status === "approved") {
                const query = { _id: new ObjectId(id) };
                const updateInfo = {
                    $set: {
                        status: data.status,
                        registrationFee: data.registrationFee
                    }
                }
                const result = await courseCollection.updateOne(query, updateInfo);
                return res.send(result);
            }

            if (data.status === "rejected") {
                const query = { _id: new ObjectId(id) };
                const updateInfo = {
                    $set: {
                        status: data.status,
                        rejectReason: data.rejectReason,
                        feedback: data.feedback
                    }
                }
                const result = await courseCollection.updateOne(query, updateInfo);
                return res.send(result);
            }

        })

        app.patch("/sessions/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) };
            const updateSession = {
                $set: {
                    tutorEmail: data.tutorEmail,
                    title: data.title,
                    description: data.description,
                    registrationStartDate: data.registrationStartDate,
                    registrationEndDate: data.registrationEndDate,
                    classStartTime: data.classStartTime,
                    classEndDate: data.classEndDate,
                    registrationFee: parseInt(data.registrationFee),
                    duration: data.duration
                }
            }
            const result = await courseCollection.updateOne(query, updateSession);
            res.send(result);
        })

        app.patch("/session/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateStatus = {
                $set: {
                    status: "pending"
                }
            }
            const result = await courseCollection.updateOne(query, updateStatus);
            res.send(result);
        })

        app.delete("/courses/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await courseCollection.deleteOne(query);
            res.send(result);
        })

        // booked related api
        app.get("/booked/:email", verifyToken, async (req, res) => {
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

        app.post("/booked", verifyToken, async (req, res) => {
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
        app.get("/review/:id", async (req, res) => {
            const id = req.params.id;
            const query = { sessionId: id }
            const result = await reviewCollection.findOne(query);
            res.send(result);
        })

        app.post("/review", async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        // Notes related api
        app.get("/notes/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await notesCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/myNotes/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await notesCollection.findOne(query);
            res.send(result);
        })

        app.post("/notes", verifyToken, async (req, res) => {
            const note = req.body;
            const result = await notesCollection.insertOne(note);
            res.send(result);
        })

        app.patch("/notes/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const note = req.body;
            const query = { _id: new ObjectId(id) };
            const updateNote = {
                $set: {
                    title: note?.title,
                    description: note?.description
                }
            }
            const result = await notesCollection.updateOne(query, updateNote);
            res.send(result);
        })

        app.delete("/notes/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await notesCollection.deleteOne(query)
            res.send(result);
        })

        // Materials related api
        app.get("/materials", verifyToken, async (req, res) => {
            const result = await materialsCollection.find().toArray();
            res.send(result);
        })

        app.get("/materials/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { tutorEmail: email };
            const result = await materialsCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/material/:sessionId", verifyToken, async (req, res) => {
            const id = req.params.sessionId;
            const query = { sessionId: id };
            const result = await materialsCollection.find(query).toArray();
            res.send(result);
        })

        app.post("/materials", verifyToken, async (req, res) => {
            const data = req.body;
            const result = await materialsCollection.insertOne(data);
            res.send(result);
        })

        app.patch("/materials/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) };
            const updateInfo = {
                $set: {
                    title: data.title,
                    image: data.image,
                    material: data.material
                }
            }
            const result = await materialsCollection.updateOne(query, updateInfo);
            res.send(result);
        })

        app.delete("/materials/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await materialsCollection.deleteOne(query);
            res.send(result);
        })

        // Tutor related api
        app.get("/tutors", async (req, res) => {
            const query = { role: "tutor" };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // Stripe payment intent
        app.post("/create-payment-intent", verifyToken, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            })
            res.send({ clientSecret: paymentIntent.client_secret, })

        })

        // await client.db("admin").command({ ping: 1 });
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