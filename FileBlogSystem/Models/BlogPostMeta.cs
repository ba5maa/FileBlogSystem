using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FileBlogSystem.Models
{
    public class BlogPostMeta
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreationDate { get; set; } = DateTime.UtcNow;
        [JsonPropertyName("PublishedDate")]
        public DateTime? PublishedDate { get; set; }

        [JsonPropertyName("ModificationDate")]
        public DateTime ModificationDate { get; set; }= DateTime.UtcNow;

        public List<string> Tags { get; set; } = new List<string>();
        public List<string> Categories { get; set; } = new List<string>();

        [JsonPropertyName("CustomUrl")]
        public string? CustomUrl { get; set; }

        public string? Slug { get; set; }

        [JsonIgnore]
        public string? ContentFilePath { get; set; }
        [JsonIgnore]
        public string? PostFolderPath { get; set; }
        [JsonPropertyName("isDraft")]
        public bool IsDraft { get; set; }= true;
        public string Content { get; set; } = string.Empty;
        public string? ImageUrl { get; set; } 
        public string AuthorUsername { get; set; } = string.Empty;
    }
}