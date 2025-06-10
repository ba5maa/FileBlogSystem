namespace FileBlogSystem.Security
{
    public static class PasswordHasher
    {
        // Hashes a password using BCrypt.
        // Generates a salt automatically.
        public static string HashPassword(string password)
        {
            // BCrypt.Net-Next handles salting internally.
            // Work factor 10 is standard, higher means more secure but slower.
            return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);
        }

        // Verifies a password against a stored hash.
        public static bool VerifyPassword(string password, string hashedPassword)
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
            }
            catch (BCrypt.Net.SaltParseException ex)
            {
                // Log this or handle appropriately if a hash is malformed
                Console.WriteLine($"Error verifying password: {ex.Message}");
                return false;
            }
        }
    }
}