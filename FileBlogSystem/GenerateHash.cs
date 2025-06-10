using System;
using BCrypt.Net; // Make sure you have the package added to your project
using FileBlogSystem.Security; // Assuming this is within your FileBlogSystem project for simplicity

// To run this:
// 1. Ensure you have BCrypt.Net-Next NuGet package installed in your main project.
// 2. Open a terminal in your project folder (FileBlogSystem).
// 3. Run: dotnet run GenerateHash.cs

public class GenerateHash
{
    public static void Main(string[] args)
    {
        Console.Write("Enter password to hash: ");
        string password = Console.ReadLine() ?? string.Empty;

        if (string.IsNullOrEmpty(password))
        {
            Console.WriteLine("Password cannot be empty.");
            return;
        }

        string hashedPassword = PasswordHasher.HashPassword(password);
        Console.WriteLine($"\nHashed Password: {hashedPassword}");
        Console.WriteLine($"\n(Copy this into your profile.json for the admin user)");

        Console.WriteLine("\nVerifying...");
        bool isValid = PasswordHasher.VerifyPassword(password, hashedPassword);
        Console.WriteLine($"Verification Result: {isValid}");
    }
}