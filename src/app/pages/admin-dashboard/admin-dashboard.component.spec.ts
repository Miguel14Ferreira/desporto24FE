import { AdminDashboardComponent } from './admin-dashboard.component';

describe('AdminDashboardComponent — navigation only', () => {
  it('does not initialize metrics or trigger dashboard API requests', () => {
    const component = new AdminDashboardComponent();
    expect(component).toBeDefined();
    expect('refreshIndicators' in component).toBeFalse();
    expect('loadOverview' in component).toBeFalse();
    expect('loadGrowth' in component).toBeFalse();
  });
});
