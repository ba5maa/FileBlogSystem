using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FileBlogSystem.Models
{
    public class BlogPostMetaResponse
    {
        public Guid Id { get; set; } 
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreationDate { get; set; }
        [JsonPropertyName("PublishedDate")]
        public DateTime? PublishedDate { get; set; }

        [JsonPropertyName("ModificationDate")]
        public DateTime ModificationDate { get; set; } 

        public List<Guid> Tags { get; set; } = new List<Guid>();
        public List<Guid> Categories { get; set; } = new List<Guid>();

        [JsonPropertyName("CustomUrl")]
        public string? CustomUrl { get; set; }

        public string? Slug { get; set; }

        [JsonIgnore]
        public string? ContentFilePath { get; set; }
        [JsonIgnore]
        public string? PostFolderPath { get; set; }
        [JsonPropertyName("isDraft")]
        public bool IsDraft { get; set; } = true;
        public string Content { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public string AuthorUsername { get; set; } = string.Empty;
        public DateTime? ScheduledFor { get; set; }
    }
}