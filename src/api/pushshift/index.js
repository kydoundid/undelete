const chunkSize = 100;
const postURL    = 'https://api.pushshift.io/reddit/submission/search/?ids='
const commentURL = `https://api.pushshift.io/reddit/comment/search/?size=${chunkSize}&sort=asc&fields=author,body,created_utc,id,link_id,parent_id,score,subreddit&q=*&link_id=`

const sleep = ms =>
  new Promise(slept => setTimeout(slept, ms))

const max = (a, b) =>
  a > b ? a : b

export const getPost = threadID =>
  window.fetch(`${postURL}${threadID}`)
    .then(response => response.json())
    .then(({ data }) => data[0])
    .catch(() => {
      throw new Error('Could not get removed post')
    })

// Helper function that fetches a list of comments using a binary backoff,
// and also returns the next delay which should be passed back in
const fetchComments = (threadID, after, delay) =>
  window.fetch(`${commentURL}${threadID}&after=${after}`)
    .then(response => response.json())
    .then(({ data }) =>
      [ data.map(comment => ({
          ...comment,
          parent_id: comment.parent_id.substring(3) || threadID,
          link_id:   comment.link_id.substring(3)   || threadID
        })),
        delay
      ]
    )
    .catch(() => {
      if (delay > 8000)
        throw new Error('Could not get removed comments');
      return sleep(delay)
        .then(() => fetchComments(threadID, after, delay * 2))
    })

export const getComments = (threadID, chunks = 10, after = 0, delay = 500) =>
  fetchComments(threadID, after, delay)
    .then(([comments, newDelay]) => {
      if (comments.length < chunkSize/2 || chunks <= 1)
        return comments;
      const newAfter = max(comments[comments.length - 1].created_utc - 1, after + 1);
      return (newDelay > 500 ? sleep(newDelay / 2) : Promise.resolve())
        .then(() => getComments(threadID, chunks - 1, newAfter, newDelay))
        .then(remainingComments => {
          const seenIDs = new Set(comments.map(c => c.id));
          for (var i = 0; i < remainingComments.length; i++) {
            if ( ! seenIDs.has(remainingComments[i].id) )
              break
          }
          comments.push(...remainingComments.slice(i));
          return comments;
        })
    })
