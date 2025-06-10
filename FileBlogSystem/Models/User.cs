using System.Collections.Generic;
using System.Text.Json.Serialization; 

namespace FileBlogSystem.Models
{
    public class User
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new List<string>();
        [JsonPropertyName("HashedPassword")]
        public string HashedPassword { get; set; } = string.Empty;
        [JsonIgnore]
        public string? Id { get; set; }
    }
}