# Vox — Voice-Powered AI Assistant

Vox is a voice-first AI assistant that allows users to interact with an AI model using speech instead of typing. It captures voice input, processes it, and returns intelligent responses in real time.

The goal of this project is to eliminate friction in human-computer interaction by making conversations with AI feel natural, fast, and effortless.

---

## Features

### Voice Input (Speech Recognition)

Users can speak directly to the app instead of typing. The browser captures audio input and converts it into text using built-in speech recognition.

### AI-Powered Responses

The transcribed text is sent to an AI model via API, which processes the request and returns a meaningful response.

### Real-Time Interaction

The system responds quickly, creating a smooth conversational experience.

### Simple Web Interface

A clean frontend built using HTML, CSS, and JavaScript ensures ease of use without unnecessary complexity.

---

## Tech Stack

### Frontend

* HTML
* CSS
* JavaScript (Vanilla JS)
* Browser Speech Recognition API

### Backend

* Node.js (Serverless function)
* API route handling using Vercel

### AI Integration

* Groq API (`llama3-8b-8192` model)

---

## Project Structure

```bash
vox/
│── api/
│   └── chat.js        # Serverless API for handling AI requests
│
│── public/
│   ├── index.html     # Main UI
│   ├── script.js      # Frontend logic (voice + API calls)
│   ├── style.css      # Styling
│   └── bg.png         # Background asset
│
│── .gitignore         # Ignored files
│── package.json       # Project config
│── vercel.json        # Deployment config
│── README.md          # Documentation
```

---

## How It Works (Step-by-Step)

1. The user speaks into the microphone
2. The browser converts speech to text
3. The text is sent to the backend (`/api/chat`)
4. Backend forwards the request to the AI model
5. AI processes and generates a response
6. Response is sent back and displayed to the user

---

## Environment Variables

Create a `.env` file in the root directory:

```bash
GROQ_API_KEY=your_api_key_here
```

Never push this file to GitHub.

---

## Running Locally

```bash
npm install
npm run dev
```

Then open:

```
http://localhost:3000
```

---

## Deployment (Vercel)

1. Push project to GitHub
2. Go to Vercel
3. Import repository
4. Add environment variable:

   * `GROQ_API_KEY`
5. Deploy

---

## Known Limitations

* Requires microphone permissions
* Speech recognition depends on browser support (best on Chrome)
* No conversation memory (stateless responses)

---

## Future Improvements

* Add conversation history
* Improve UI/UX
* Add voice output (text-to-speech)
* Support multiple AI models
* Add authentication

---

## Author

Built as a personal project to explore voice interfaces and AI integration.

---

## License

This project is open-source and available under the MIT License.
