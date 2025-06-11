using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models
{
    public class CreateUserRequest
    {
        [Required]
        [MinLength(3)]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        [MaxLength(255)]
        public string HashedPassword { get; set; } = string.Empty; 

        public List<string> Roles { get; set; } = new List<string>();
    }
}