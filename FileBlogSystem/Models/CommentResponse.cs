using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FileBlogSystem.Models
{
    public class CommentModel
    {
        public Guid Id { get; set; }
        public string Username { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
