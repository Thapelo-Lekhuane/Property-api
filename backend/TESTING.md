# Testing Guide for Property API

This document provides an overview of the testing setup and procedures for the Property API project with Firebase Authentication.

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Firebase project with Authentication enabled
- Service account key file (`serviceAccountKey.json`) in the project root
- Environment variables properly configured (see `.env.example`)

## Test Dependencies

- **Jest**: Test framework
- **Supertest**: HTTP assertions
- **MongoDB Memory Server**: In-memory MongoDB for testing
- **Firebase Admin SDK**: For Firebase Authentication
- **Nock**: HTTP server mocking (for external services)

## Setting Up Test Environment

1. Create a `.env.test` file in your project root with test-specific configurations:

```env
NODE_ENV=test
PORT=5001
MONGO_URI=mongodb://localhost:27017/cyc-acres-test
FIREBASE_PROJECT_ID=your-test-project-id
FRONTEND_URL=http://localhost:3000
```

2. Make sure your Firebase project has a test user created for testing purposes.

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Authentication Tests Only

```bash
npx jest test/auth.test.js --detectOpenHandles --forceExit
```

### Run in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

## Testing Firebase Authentication

### Test User Credentials

For local testing, you can use these test credentials (make sure to create this user in your Firebase project):

- **Email**: test@example.com
- **Password**: test1234

### Authentication Test Cases

1. **User Registration**
   - Test successful registration with valid data
   - Test registration with existing email
   - Test registration with missing required fields

2. **User Login**
   - Test successful login with valid credentials
   - Test login with invalid credentials
   - Test login with non-existent user

3. **Password Reset**
   - Test password reset flow
   - Test password reset with invalid token

4. **Protected Routes**
   - Test access to protected routes without token
   - Test access with invalid/expired token
   - Test role-based access control

## Test Structure

Tests are organized in the `test` directory with the following structure:

```
test/
  ├── auth.test.js         # Authentication controller tests
  ├── booking.test.js      # Booking controller tests
  ├── property.test.js     # Property controller tests
  └── review.test.js       # Review controller tests
```

## Test Environment

- Tests use an in-memory MongoDB instance provided by `mongodb-memory-server`.
- External services (like Cloudinary and email) are mocked.
- Test data is set up before each test and cleaned up afterward.

## Writing Tests

1. **Test Files**: Create new test files with the `.test.js` extension in the `test` directory.
2. **Test Structure**:
   ```javascript
   describe('Feature Name', () => {
     beforeAll(() => {
       // Setup code
     });

     afterAll(() => {
       // Cleanup code
     });

     it('should do something', async () => {
       // Test code
     });
   });
   ```

3. **Mocking**: Use Jest's mocking capabilities to mock external dependencies.

## Debugging Tests

To debug tests, use the `--inspect-brk` flag with Node.js:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open Chrome and navigate to `chrome://inspect` to debug.

## Best Practices

- Write small, focused tests that test one thing.
- Use descriptive test names.
- Mock external dependencies.
- Clean up test data after each test.
- Keep tests independent and isolated.
