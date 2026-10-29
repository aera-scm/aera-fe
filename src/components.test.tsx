import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Source, sourceSummary } from './components';

describe('source tooltip', () => {
  it('FR-IMP-03 a figure from many records shows two references and a count', () => {
    const ref = Array.from({ length: 10 }, (_, i) => `SAP:API_SALES_ORDER_SRV/A_SalesOrderItem(SalesOrder='${2000451 + i}')/NetAmount`).join(' + ');
    render(<Source sourceRef={ref}>$4.72M</Source>);
    const figure = screen.getByText('$4.72M');
    expect(figure).toHaveAttribute('data-source-ref', ref);
    expect(figure).toHaveAttribute('title', ref);
    expect(figure.querySelectorAll('.source-lines > span')).toHaveLength(3);
    expect(screen.getByText('+8 more sources')).toBeInTheDocument();
  });

  it('FR-IMP-03 a single reference is shown in full', () => {
    expect(sourceSummary('case:EXC-1/rarUsd')).toEqual({ refs: ['case:EXC-1/rarUsd'], more: 0 });
    expect(sourceSummary('a | b | c')).toEqual({ refs: ['a', 'b'], more: 1 });
  });
});
