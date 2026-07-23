import "dotenv/config";

// Les tests adossés à la base n'utilisent JAMAIS DATABASE_URL directement :
// il faut fournir TEST_DATABASE_URL explicitement, sinon ils sont ignorés.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
