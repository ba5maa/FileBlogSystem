namespace FileBlogSystem.Security
{
    public static class PasswordHasher
    {
        public static string HashPassword(string password)
        {
            Console.WriteLine($"hashedpasswords: {BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10)} for {password}");

            return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);
        }

        public static bool VerifyPassword(string password, string hashedPassword)
        {
            try
            {   
                    Console.WriteLine($"checking passwords: {password} and {hashedPassword}");

                return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
            }
            catch (BCrypt.Net.SaltParseException ex)
            {
                Console.WriteLine($"Error verifying password: {ex.Message}");
                return false;
            }
        }
    }
}