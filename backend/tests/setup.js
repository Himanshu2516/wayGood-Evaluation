const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const University = require("../src/models/University");
const Program = require("../src/models/Program");
const Student = require("../src/models/Student");
const Application = require("../src/models/Application");
const seedData = require("../src/data/seedData");
const cacheService = require("../src/services/cacheService");

let mongoServer;

async function setupTestDB() {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000,
    },
    binary: {
      version: "4.4.18",
      systemBinary: "C:\\Users\\ACER\\.cache\\mongodb-binaries\\mongod-x64-win32-4.4.18.exe",
    },
  });

  const uri = mongoServer.getUri();
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await cacheService.clear();
}

async function teardownTestDB() {
  await cacheService.clear();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

async function clearDatabase() {
  await cacheService.clear();
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function seedTestDB() {
  await clearDatabase();

  const universities = await University.insertMany(seedData.universities);

  const universityByName = universities.reduce((acc, u) => {
    acc[u.name] = u;
    return acc;
  }, {});

  const programs = await Program.insertMany(
    seedData.programs.map((p) => ({
      ...p,
      university: universityByName[p.universityName]._id,
    }))
  );

  const programByTitle = programs.reduce((acc, p) => {
    acc[p.title] = p;
    return acc;
  }, {});

  const students = await Student.create(seedData.students);

  const studentByEmail = students.reduce((acc, s) => {
    acc[s.email] = s;
    return acc;
  }, {});

  const applications = seedData.applications.map((app) => {
    const student = studentByEmail[app.studentEmail];
    const program = programByTitle[app.programTitle];
    const university = universityByName[program.universityName];

    return {
      student: student._id,
      program: program._id,
      university: university._id,
      destinationCountry: program.country,
      intake: app.intake,
      status: app.status,
      timeline: app.timeline,
      statusHistory: [
        {
          status: app.status,
          changedBy: student._id,
          changedByRole: "student",
          note: "Seeded application",
          changedAt: new Date(),
        },
      ],
    };
  });

  await Application.insertMany(applications);

  return { universities, programs, students };
}

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearDatabase,
  seedTestDB,
};
