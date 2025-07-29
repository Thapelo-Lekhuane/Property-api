# Property-api
# 🏡 CYC Acres (PTY) LTD – Property Listing & Booking Website  
### *(Coolest Yet Cheapest)*

**CYC Acres** is a modern, user-friendly web application that allows people to browse bachelor rooms, view real-time availability, and book viewings — with a sleek, Instagram-style image layout. The platform is built with affordability, speed, and simplicity in mind.

---

## 🌐 Features

- Public browsing of room listings (no login required)
- Image hover effects showing room info (price, bathroom, parking, etc.)
- Real-time availability calendar per room
- User registration/login for bookings and EFT uploads
- Booking system tied to user accounts
- Uploading of EFT payment proof after booking
- Admin-only room posting and management
- Cloud-based image upload integration

---

## 🚀 Tech Stack

**Frontend (Planned):**
- HTML5 / CSS3 / JavaScript
- React.js
- FullCalendar.js
- TailwindCSS (optional)

**Backend (This Repo):**
- Node.js + Express.js
- MongoDB + Mongoose
- Cloudinary (image hosting)
- Firebase Authentication
- Firebase Admin SDK
- dotenv (environment variables)

---

## 🔐 Authentication (Firebase)

This project uses Firebase Authentication for user management. The following endpoints are available:

### Public Endpoints
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/forgotpassword` - Request password reset
- `POST /api/v1/auth/resetpassword` - Reset password with OOB code
- `GET /api/v1/auth/verify-email` - Verify email with OOB code

### Protected Endpoints (Require Firebase ID Token)
- `GET /api/v1/auth/me` - Get current user profile
- `PUT /api/v1/auth/updatedetails` - Update user details
- `PUT /api/v1/auth/updatepassword` - Update password
- `POST /api/v1/auth/logout` - Logout user

### Admin Endpoints
- `PUT /api/v1/auth/updaterole/:id` - Update user role (admin only)

## 🔧 Setup

1. Create a Firebase project and enable Email/Password authentication
2. Download the service account key (JSON) and save as `serviceAccountKey.json` in the project root
3. Add your Firebase configuration to `.env`:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----"
FRONTEND_URL=http://localhost:3000
```

## 📁 Folder Structure

Project: `cyc-acres-backend`

- `config/` – Database, Cloudinary, Firebase config files  
- `controllers/` – Route logic for properties, auth, bookings  
  - `authController.js` – Authentication logic with Firebase  
  - `userController.js` – User profile management  
- `middleware/` – Auth middleware and role checks  
  - `firebaseAuth.js` – Firebase authentication middleware  
- `routes/` – REST API endpoints  
  - `authRoutes.js` – Authentication routes  
- `models/` – Mongoose schemas (Property, Booking, etc.)  
- `utils/` – Helper functions  
- `.env` – Store sensitive config variables  
- `app.js` – Express setup  
- `server.js` – Entry point to launch app  
- `README.md` – This file

---

## 🛡️ Roles and Permissions

| Role     | View Listings | Book Rooms | Upload EFT | Post Rooms |
|----------|---------------|------------|------------|------------|
| Visitor  | ✅             | ❌         | ❌         | ❌         |
| User     | ✅             | ✅         | ✅         | ❌         |
| Admin    | ✅             | ✅         | ✅         | ✅         |

---

## 🛠️ Getting Started

**1. Clone the Repository**

```bash
git clone https://github.com/your-username/cyc-acres-backend.git
cd cyc-acres-backend



2. Install Dependencies

bash
Copy
Edit
npm install
3. Create a .env File

Create a .env file in the root with the following keys:


PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
FIREBASE_API_KEY=your_firebase_api_key (optional)
JWT_SECRET=your_jwt_secret
4. Start the Server


npm run dev
📦 REST API Overview
Public Endpoints
GET /api/properties – View all property listings

GET /api/properties/:id – View single room + availability

Auth Endpoints
POST /api/auth/register – Register a user

POST /api/auth/login – Login a user

GET /api/auth/me – Get logged-in user info

Booking Endpoints (Authenticated)
POST /api/bookings – Book a room viewing

GET /api/bookings/my – View your bookings

GET /api/availability/:propertyId – Get available dates

Admin Endpoints (Authenticated + Admin Only)
POST /api/properties – Create new room listing

PUT /api/properties/:id – Update listing

DELETE /api/properties/:id – Delete listing

✨ Visual UI (Planned)
Property cards with hover effects showing:

💰 Price

🛁 Bathroom info

🚗 Parking availability

🪑 Furnished status

📍 Location

Calendar view per room using FullCalendar.js

Responsive design for mobile & desktop

🔐 Role-Based Access Middleware
The backend includes middleware that:

Verifies JWT or Firebase token

Checks if the user has admin role before allowing property posting or editing

📌 Future Improvements
Admin dashboard (React) to manage rooms & users

SMS/email notifications for bookings

Payment gateway integration (e.g. Yoco or PayFast)

Landlord-side account management (optional)

Chat or messaging feature between user and admin

🧩 Integration Services
Service	Purpose
Cloudinary	Image uploads
Firebase Auth / JWT	User authentication
MongoDB Atlas	Database
FullCalendar.js	Calendar UI
