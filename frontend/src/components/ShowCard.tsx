import React from 'react';
import { CardShow } from '@shared/types/show';
import '../styles/show-card.css';

interface ShowCardProps {
  show: CardShow;
  onClick?: (show: CardShow) => void;
}

const ShowCard: React.FC<ShowCardProps> = ({ show, onClick }) => {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="show-card" onClick={() => onClick?.(show)}>
      <div className="show-image">
        {show.imageUrl ? (
          <img src={show.imageUrl} alt={show.showName} />
        ) : (
          <div className="placeholder-image">
            <span>Card Show</span>
          </div>
        )}
      </div>

      <div className="show-content">
        <h3 className="show-name">{show.showName}</h3>

        <div className="show-meta">
          <div className="meta-item">
            <span className="label">Date:</span>
            <span className="value">{formatDate(show.date)}</span>
          </div>
          <div className="meta-item">
            <span className="label">Time:</span>
            <span className="value">{show.startTime}</span>
          </div>
          <div className="meta-item">
            <span className="label">Location:</span>
            <span className="value">{show.city}, {show.region}</span>
          </div>
        </div>

        <div className="show-address">
          <span className="label">Address:</span>
          <p>{show.address}</p>
        </div>

        {show.tags && show.tags.length > 0 && (
          <div className="show-tags">
            {show.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="show-footer">
          {show.websiteUrl && (
            <a href={show.websiteUrl} target="_blank" rel="noopener noreferrer" className="website-link">
              Visit Website
            </a>
          )}
          {show.admissionPrice && (
            <span className="admission-price">{show.admissionPrice}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowCard;
