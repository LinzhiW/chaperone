import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function listModels() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("No API key found in server/.env");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    // Note: listModels is a top-level function on genAI in some SDK versions, 
    // or requires a specific endpoint. Let's try the direct fetch approach.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Available Models for your API Key:");
    if (data.models) {
      data.models.forEach((m: any) => console.log(`- ${m.name}`));
    } else {
      console.log("No models returned:", data);
    }
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

listModels();
