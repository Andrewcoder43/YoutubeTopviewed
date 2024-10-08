import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce';
import './App.css'; // Import the CSS file

const API_KEY = 'AIzaSyCpwokDs7Vhp4CBGCUKhyFYyOeuhPstxEQ'; // Replace with your actual API key 

function App() {
  const [videos, setVideos] = useState([]);
  const [minViews, setMinViews] = useState(0);
  const [maxViews, setMaxViews] = useState(Number.MAX_SAFE_INTEGER);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('desc');
  const [nextPageToken, setNextPageToken] = useState('');
  const [prevPageToken, setPrevPageToken] = useState('');
  const videosPerPage = 50;
  const [cache, setCache] = useState({});

  

  const fetchVideos = useCallback(async (startDate, endDate, currentPage, nextPageToken) => {
    try {
      // Ensure dates are in ISO format if provided
      const formattedStartDate = startDate ? new Date(startDate).toISOString() : undefined;
      const formattedEndDate = endDate ? new Date(endDate).toISOString() : undefined;

      // Log the formatted dates for debugging
      console.log('Fetching videos with dates:', formattedStartDate, formattedEndDate);

      const cacheKey = `${formattedStartDate}-${formattedEndDate}-${currentPage}`;
      if (cache[cacheKey]) {
        console.log('Using cached data for:', cacheKey);
        const cachedData = cache[cacheKey];
        setVideos(cachedData.videos);
        setNextPageToken(cachedData.nextPageToken);
        setPrevPageToken(cachedData.prevPageToken);
        return;
      }

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          maxResults: videosPerPage,
          publishedAfter: formattedStartDate,
          publishedBefore: formattedEndDate,
          type: 'video',
          pageToken: nextPageToken || undefined,
          key: API_KEY,
          fields: 'items(id(videoId)),nextPageToken,prevPageToken',
        },
      });

      const videoIds = response.data.items.map(item => item.id.videoId).join(',');

      if (videoIds) {
        const videoDetailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            part: 'snippet,statistics',
            id: videoIds,
            fields: 'items(id,snippet(title,channelTitle,publishedAt,thumbnails/default),statistics(viewCount))',
            key: API_KEY,
          },
        });

        const videoData = videoDetailsResponse.data.items.map((item, index) => ({
          rank: index + 1 + (currentPage - 1) * videosPerPage,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          uploadDate: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails.default.url,
          viewCount: parseInt(item.statistics.viewCount, 10),
          videoId: item.id,
          geography: 'US',
          language: item.snippet.defaultLanguage || 'en',
        }));

        // Sort videos by view count in descending order
        videoData.sort((a, b) => b.viewCount - a.viewCount);

        setVideos(videoData);
        setNextPageToken(response.data.nextPageToken || '');
        setPrevPageToken(response.data.prevPageToken || '');

        setCache(prevCache => ({
          ...prevCache,
          [cacheKey]: {
            videos: videoData,
            nextPageToken: response.data.nextPageToken || '',
            prevPageToken: response.data.prevPageToken || '',
          },
        }));
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  }, [cache, videosPerPage]);

  useEffect(() => {
    const debouncedFetch = debounce(fetchVideos, 500);
    debouncedFetch(startDate, endDate, currentPage, nextPageToken);

    // Cleanup function to cancel debounce on unmount
    return () => {
      debouncedFetch.cancel();
    };
  }, [startDate, endDate, currentPage, nextPageToken, fetchVideos]);

  const filteredVideos = videos
    .filter(video => video.viewCount >= minViews && video.viewCount <= maxViews)
    .sort((a, b) => (sortOrder === 'asc' ? a.viewCount - b.viewCount : b.viewCount - a.viewCount));

  const nextPage = () => {
    if (nextPageToken) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const prevPage = () => {
    if (prevPageToken) {
      setCurrentPage(prevPage => prevPage - 1);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
  };

  



  return (
    <div>
      <h1>YouTube Video Viewer</h1>
      <div>
        <label>
          Min Views:
          <input type="number" value={minViews} onChange={(e) => setMinViews(Number(e.target.value) || 0)} />
        </label>
        <label>
          Max Views:
          <input type="number" value={maxViews === Number.MAX_SAFE_INTEGER ? '' : maxViews} onChange={(e) => setMaxViews(Number(e.target.value) || Number.MAX_SAFE_INTEGER)} />
        </label>
        <label>
          Start Date:
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          End Date:
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Thumbnail</th>
            <th>Title</th>
            <th>Channel</th>
            <th>Upload Date</th>
            <th>
              Views
              <button onClick={toggleSortOrder}>
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredVideos.map((video, index) => (
            <tr key={index}>
              <td>{video.rank}</td>
              <td>
                <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">
                  <img src={video.thumbnail} alt={video.title} />
                </a>
              </td>
              <td>{video.title}</td>
              <td>{video.channelTitle}</td>
              <td>{new Date(video.uploadDate).toLocaleDateString()}</td>
              <td>{video.viewCount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button onClick={prevPage} disabled={!prevPageToken}>Previous</button>
        <button onClick={nextPage} disabled={!nextPageToken}>Next</button>
      </div>
    </div>
  );
}

export default App;