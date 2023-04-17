const express = require("express");
const app = express();
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// mongoose.connect(process.env.MONGO_URI);

const { Configuration, OpenAIApi } = require("openai");
const User = require("./user");

app.use(express.json());

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(config);

function isJson(str) {
  let result = null;
  try {
    result = JSON.parse(str);
  } catch (e) {
    return null;
  }
  return result;
}

function teachAI() {
  openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: `I told you to give me the response in a specific format. This is not it, do better next time.`,
      },
    ],
  });
}

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ message: "Please enter all fields" });
  }
  try {
    const newUser = new User({
      email,
    });
    const hashedPassword = await bcrypt.hash(password, 10);
    newUser.password = hashedPassword;
    const savedUser = await newUser.save();
    const token = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, {
      expiresIn: 3600,
    });
    return res.status(200).json({
      token,
      user: {
        id: savedUser._id,
        email: savedUser.email,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ message: "Please enter all fields" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "Invalid Email or password" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ message: "Invalid Email or password" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: 3600,
    });
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/", async (req, res) => {
  try {
    let {
      age,
      weight,
      proffession,
      height,
      level,
      goals,
      condition,
      gender,
      week,
    } = req.body;
    if (height && height === 0) {
      return res.status(400).json({
        message: "Please check your input",
      });
    }
    if (goals && typeof goals !== "string") {
      goals = goals.join(", ");
    }
    let prompt = `I am a ${age} year old ${gender}, with weight: ${weight}kg, height: ${height}cm. And I work as ${proffession} with ${
      !condition
        ? "No health conditions"
        : `these health conditions: ${condition}`
    }, I am at ${level} fitness level, with goals as: ${goals}, Give me a week workout plan bifurcated daywise in JSON format, like below:
     {"Monday": {"Exercise": "...", "Intensity": "...", "Description": "...", "StartTime": "...", "EndTime": "..."}, "Tuesday": ...}.`;
    if (week && week > 1) {
      prompt = `Now give me the workout plan for the ${week} week, in the same JOSN format,like below:{"Monday": {"Exercise": "...", "Intensity": "...", "Description": "...", "StartTime": "...", "EndTime": "..."}, "Tuesday": ...}.`;
    }
    console.log(prompt);
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });
    const data = response.data.choices[0].message.content;
    const JSONStart = data.indexOf("{");
    const JSONEnd = data.lastIndexOf("}") + 1;
    console.log(data);
    if (JSONStart === -1 || JSONEnd === -1) {
      teachAI();
      return res.status(400).json({
        message: "Please check your input",
      });
    }
    const JSONData = isJson(data.substring(JSONStart, JSONEnd));
    if (JSONData === null) {
      teachAI();
      return res.status(400).json({
        message: "Please check your input",
      });
    }
    return res.json(JSONData);
  } catch (error) {
    console.log(error);
    return res.status(400).json(error);
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Server is running on port 3000");
});
