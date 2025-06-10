using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FileBlogSystem.Models
{
    public class BlogPostMeta
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        [JsonPropertyName("PublishedDate")] 
        public DateTime PublishedDate { get; set; }

        [JsonPropertyName("ModificationDate")]
        public DateTime ModificationDate { get; set; }

        public List<string> Tags { get; set; } = new List<string>();
        public List<string> Categories { get; set; } = new List<string>();

        [JsonPropertyName("CustomUrl")]
        public string? CustomUrl { get; set; } // Nullable because it might not always be defined

        // Add a property that won't be serialized to JSON, but useful in code
        [JsonIgnore]
        public string? Slug { get; set; } 

        [JsonIgnore]
        public string? ContentFilePath { get; set; } // Path to the content.md file
        [JsonIgnore]
        public string? PostFolderPath { get; set; } // Path to the YYYY-MM-DD-post-slug folder
    }
}