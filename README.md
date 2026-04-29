🤖 AI Hiring System

An intelligent web-based application that streamlines the recruitment process by analyzing candidate data and assisting in hiring decisions.

🚀 Overview

The AI Hiring System is a full-stack web application designed to simplify and enhance the hiring workflow. It enables users to register, log in, and interact with a system that evaluates candidate profiles and provides insights to support better recruitment decisions.

This project demonstrates modern full-stack development along with AI-based analysis concepts.

✨ Features
🔐 User Authentication (Signup & Login)
📊 Interactive Dashboard
📄 Candidate/Resume Analysis (AI-based concept)
🔄 Frontend ↔ Backend API Integration
⚡ Fast and Responsive UI
🧭 Multi-page Navigation using React
🧠 AI Functionality

The system simulates intelligent hiring assistance by:

Extracting relevant information from candidate data
Identifying key skills and attributes
Comparing profiles with job requirements
Providing evaluation insights or scores

⚠️ Note: This project demonstrates AI concepts. It can be extended using NLP models or external AI APIs for production use.

🛠️ Tech Stack
🎨 Frontend
React (with Vite)
JavaScript (ES6+)
HTML5 & CSS3
Axios
Framer Motion

⚙️ Backend
FastAPI (Python)
REST API Architecture
JWT Authentication (if implemented)
SQLite / Database
🔧 Tools
Git & GitHub
Postman (API Testing)

⚙️ Installation & Setup
1️⃣ Clone the Repository
git clone https://github.com/Hemalathaa2/ai_hiring_system.git
cd ai_hiring_system
2️⃣ Setup Backend
cd backend

# Create virtual environment
python -m venv venv

# Activate environment
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload

👉 Backend runs at:
http://localhost:8000

3️⃣ Setup Frontend
cd frontend
npm install
npm run dev

👉 Frontend runs at:
http://localhost:5173

🔗 API Integration
The frontend communicates with the backend using REST APIs:
/auth/signup → Register user
/auth/login → Login user
/analyze → Candidate analysis

🧪 Usage
Register a new account
Login to the system
Access dashboard
Upload / analyze candidate data
View insights and results

📌 Conclusion
This project demonstrates a full-stack AI-powered hiring system, showcasing frontend development, backend API design, and AI-based problem-solving. It is a strong portfolio project for software development and AI-integrated applications.

⭐ If you found this project useful, feel free to star the repository!
