import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import FeedHeader from "../components/layout/FeedHeader";
import EmptyState from "../components/feedback/EmptyState";
import ErrorState from "../components/feedback/ErrorState";
import FeedSkeleton from "../components/feedback/FeedSkeleton";
import PostCard from "../components/posts/PostCard";
import PostComposer from "../components/posts/PostComposer";
import { useAuth } from "../context/AuthContext";
import { postsApi } from "../services/postsApi";

const PAGE_SIZE = 10;

export default function FeedPage() {
  const { user } = useAuth();
  const composerRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFeed = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const result = await postsApi.getPosts({ page: nextPage, limit: PAGE_SIZE });
      setPosts((current) => (append ? [...current, ...result.posts] : result.posts));
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (requestError) {
      setError(requestError.message || "Couldn't load posts.");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  function focusComposer() {
    composerRef.current?.focus();
  }

  async function handleCreatePost(values) {
    const createdPost = await postsApi.createPost(values);
    setPosts((current) => [createdPost, ...current]);
    setNotice("Your post is now live.");
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function handleToggleLike(postId) {
    const previousPost = posts.find((post) => post.id === postId);
    if (!previousPost) return;

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              viewerHasLiked: !post.viewerHasLiked,
              likeCount: Math.max(0, post.likeCount + (post.viewerHasLiked ? -1 : 1)),
            }
          : post,
      ),
    );

    try {
      const result = await postsApi.toggleLike(postId);
      if (result.post) {
        setPosts((current) => current.map((post) => (post.id === postId ? result.post : post)));
      }
    } catch (error) {
      setPosts((current) => current.map((post) => (post.id === postId ? previousPost : post)));
      throw error;
    }
  }

  async function handleAddComment(postId, text) {
    const result = await postsApi.addComment(postId, text);
    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post;
        if (result.post) return result.post;
        if (result.comment) {
          return {
            ...post,
            comments: [...post.comments, result.comment],
            commentCount: post.commentCount + 1,
          };
        }
        return post;
      }),
    );
  }

  return (
    <AppShell onCompose={focusComposer}>
      <div className="feed-page">
        <FeedHeader onCompose={focusComposer} />
        <PostComposer ref={composerRef} onCreate={handleCreatePost} user={user} />

        {notice ? <div className="feed-notice" role="status">{notice}</div> : null}

        <section className="feed-list" aria-label="Community posts">
          {loading ? <FeedSkeleton /> : null}
          {!loading && error && !posts.length ? (
            <ErrorState title="Couldn't load the feed" message={error} onRetry={() => loadFeed()} />
          ) : null}
          {!loading && !error && !posts.length ? <EmptyState onCreate={focusComposer} /> : null}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onToggleLike={handleToggleLike}
              onAddComment={handleAddComment}
            />
          ))}

          {error && posts.length ? <p className="feed-list__inline-error" role="alert">{error}</p> : null}

          {hasMore ? (
            <button
              className="button button--secondary feed-list__load-more"
              type="button"
              disabled={loadingMore}
              onClick={() => loadFeed({ nextPage: page + 1, append: true })}
            >
              {loadingMore ? "Loading more…" : "Load more posts"}
            </button>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

