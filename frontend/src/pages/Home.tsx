import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import SearchFilters from '../components/SearchFilters';
import ShowCard from '../components/ShowCard';
import { CardShow, PaginatedResponse } from '@shared/types/show';
import '../styles/home.css';

interface FilterState {
  startDate: string;
  endDate: string;
  city: string;
  radius: number;
  tags: string[];
  searchText: string;
}

const HomePage: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    city: '',
    radius: 50,
    tags: [],
    searchText: '',
  });

  const [shows, setShows] = useState<CardShow[]>([]);
  const [bcCities] = useState(['Vancouver', 'Victoria', 'Kelowna', 'Calgary', 'Surrey']);

  // Fetch shows from API
  const { data, isLoading, error } = useQuery(
    ['shows', filters],
    async () => {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.city && { city: filters.city }),
        ...(filters.tags.length > 0 && { tags: filters.tags.join(',') }),
        search: filters.searchText,
        limit: '50',
      });

      const response = await fetch(`/api/shows?${params}`);
      if (!response.ok) throw new Error('Failed to fetch shows');
      return response.json() as Promise<PaginatedResponse<CardShow>>;
    },
    { enabled: true }
  );

  useEffect(() => {
    if (data?.data) {
      setShows(data.data);
    }
  }, [data]);

  const handleFilter = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Find Card Shows in British Columbia</h1>
        <p>Discover upcoming trading card shows near you</p>
      </section>

      <div className="page-container">
        <aside className="filters-sidebar">
          <SearchFilters onFilter={handleFilter} cities={bcCities} />
        </aside>

        <main className="shows-grid">
          {isLoading && (
            <div className="loading">
              <p>Loading shows...</p>
            </div>
          )}

          {error && (
            <div className="error">
              <p>Error loading shows. Please try again.</p>
            </div>
          )}

          {shows.length === 0 && !isLoading && (
            <div className="no-results">
              <p>No shows found for your filters. Try adjusting your search.</p>
            </div>
          )}

          <div className="shows-list">
            {shows.map(show => (
              <ShowCard key={show.showId} show={show} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;
