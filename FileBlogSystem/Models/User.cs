using System.Collections.Generic;

namespace FileBlogSystem.Models
{
    public class User
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new List<string>();

        // Note: i'll handle secure password storage later, not directly in this model for now.
    }
}