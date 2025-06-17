using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FileBlogSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PostsController : ControllerBase
    {
        private readonly IContentService _contentService;
        private readonly ILogger<PostsController> _logger;

        public PostsController(IContentService contentService, ILogger<PostsController> logger)
        {
            _contentService = contentService;
            _logger = logger;
        }

        // GET: api/posts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BlogPostMeta>>> GetAllPosts()
        {
            _logger.LogInformation("Attempting to get all blog posts.");
            var posts = await _contentService.GetAllBlogPostsMetaAsync();

            if (posts == null || !posts.Any())
            {
                _logger.LogWarning("No blog posts found.");
                return NotFound("No blog posts found.");
            }
            return Ok(posts);
        }

        // GET: api/posts/{slug}
        [HttpGet("{slug}")]
        public async Task<ActionResult<BlogPostMeta>> GetPostBySlug(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                _logger.LogWarning("GetPostBySlug called with null or empty slug.");
                return BadRequest("Slug cannot be empty.");
            }

            _logger.LogInformation($"Attempting to get blog post by slug: {slug}");
            var post = await _contentService.GetBlogPostMetaBySlugAsync(slug);

            if (post == null)
            {
                _logger.LogWarning($"Blog post with slug '{slug}' not found.");
                return NotFound($"Blog post with slug '{slug}' not found.");
            }
            return Ok(post);
        }

        // POST: api/posts
        [HttpPost]
        public async Task<ActionResult<BlogPostMeta>> CreatePost([FromBody] CreateBlogPostRequest request)
        {
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Invalid model state for CreatePost request.");
                return BadRequest(ModelState);
            }

            _logger.LogInformation($"Attempting to create a new blog post with title: {request.Title}");
            var newPost = await _contentService.CreateBlogPostAsync(request);

            if (newPost == null)
            {
                _logger.LogError($"Failed to create blog post with title: {request.Title}");
                return StatusCode(500, "Failed to create blog post.");
            }

            return CreatedAtAction(nameof(GetPostBySlug), new { slug = newPost.Slug }, newPost);
        }

        // PUT: api/posts/{originalSlug}
        [HttpPut("{originalSlug}")]
        public async Task<ActionResult<BlogPostMeta>> UpdatePost(string originalSlug, [FromBody] UpdateBlogPostRequest request)
        {
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Invalid model state for UpdatePost request.");
                return BadRequest(ModelState);
            }

            if (string.IsNullOrWhiteSpace(originalSlug))
            {
                _logger.LogWarning("UpdatePost called with null or empty originalSlug.");
                return BadRequest("Original slug cannot be empty.");
            }

            _logger.LogInformation($"Attempting to update blog post with original slug: {originalSlug}");
            var updatedPost = await _contentService.UpdateBlogPostAsync(originalSlug, request);

            if (updatedPost == null)
            {
                _logger.LogWarning($"Blog post with original slug '{originalSlug}' not found or update failed.");
                return NotFound($"Blog post with original slug '{originalSlug}' not found or update failed. Check logs for details.");
            }

            return Ok(updatedPost);
        }

        // DELETE: api/posts/{slug}
        [HttpDelete("{slug}")]
        public async Task<IActionResult> DeletePost(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                _logger.LogWarning("DeletePost called with null or empty slug.");
                return BadRequest("Slug cannot be empty.");
            }

            _logger.LogInformation($"Attempting to delete blog post with slug: {slug}");
            var deleted = await _contentService.DeleteBlogPostAsync(slug);

            if (!deleted)
            {
                _logger.LogWarning($"Blog post with slug '{slug}' not found or deletion failed.");
                return NotFound($"Blog post with slug '{slug}' not found or deletion failed.");
            }

            return NoContent();
        }
    }
}