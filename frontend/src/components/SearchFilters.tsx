import React, { useState } from 'react';
import '../styles/search-filters.css';

interface FilterState {
  startDate: string;
  endDate: string;
  city: string;
  radius: number;
  tags: string[];
  searchText: string;
}

interface SearchFiltersProps {
  onFilter: (filters: FilterState) => void;
  cities: string[];
}

const CARD_TYPES = [
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'mtg', label: 'Magic: The Gathering' },
  { value: 'yugioh', label: 'Yu-Gi-Oh!' },
  { value: 'sports-cards', label: 'Sports Cards' },
];

const SearchFilters: React.FC<SearchFiltersProps> = ({ onFilter, cities }) => {
  const [filters, setFilters] = useState<FilterState>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    city: '',
    radius: 50,
    tags: [],
    searchText: '',
  });

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleCityChange = (value: string) => {
    const newFilters = { ...filters, city: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleRadiusChange = (value: number) => {
    const newFilters = { ...filters, radius: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleTagChange = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    const newFilters = { ...filters, tags: newTags };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleSearchChange = (value: string) => {
    const newFilters = { ...filters, searchText: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  return (
    <div className="search-filters">
      <div className="filter-section">
        <label htmlFor="search">Search Shows</label>
        <input
          id="search"
          type="text"
          placeholder="Search by name or location..."
          value={filters.searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-row">
        <div className="filter-section">
          <label htmlFor="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
          />
        </div>

        <div className="filter-section">
          <label htmlFor="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
          />
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-section">
          <label htmlFor="city">City</label>
          <select
            id="city"
            value={filters.city}
            onChange={(e) => handleCityChange(e.target.value)}
          >
            <option value="">All Cities</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="filter-section">
          <label htmlFor="radius">Radius: {filters.radius} km</label>
          <input
            id="radius"
            type="range"
            min="5"
            max="100"
            value={filters.radius}
            onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="filter-section">
        <label>Card Types</label>
        <div className="tag-list">
          {CARD_TYPES.map(cardType => (
            <label key={cardType.value} className="tag-checkbox">
              <input
                type="checkbox"
                checked={filters.tags.includes(cardType.value)}
                onChange={() => handleTagChange(cardType.value)}
              />
              <span>{cardType.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;
