import mongoose from 'mongoose';

// Bound how long model operations may wait while the connection is unavailable.
mongoose.set('bufferTimeoutMS', 5000);

export async function connectDatabase(uri) {
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('Set a valid MONGODB_URI in server/.env. See server/.env.example.');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
  } catch {
    // Driver errors can contain connection details. Do not log the URI or credentials.
    throw new Error('MongoDB connection failed. Check that MongoDB is running and verify MONGODB_URI, credentials, and network access.');
  }
}

export async function isDatabaseReady() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
    return true;
  } catch {
    return false;
  }
}
