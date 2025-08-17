using FileBlogSystem.Models;

public interface ILuceneSearchService
{
    public Task RebuildIndexAsync(CancellationToken ct = default);
    public Task IndexOrUpdateAsync(BlogPostMetaResponse meta, string content, CancellationToken ct = default);
    public Task DeleteBySlugAsync(string slug, CancellationToken ct = default);
    public Task<IReadOnlyList<string>> SearchSlugsAsync(string query, int limit = 50, CancellationToken ct = default);
}
