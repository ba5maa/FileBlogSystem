using System.ComponentModel.DataAnnotations; // For validation attributes

namespace FileBlogSystem.Models
{
    public class LoginRequest
    {
        [Required] // Marks this property as required
        public string Username { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}