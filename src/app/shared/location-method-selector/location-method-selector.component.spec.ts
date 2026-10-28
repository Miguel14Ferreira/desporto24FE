import { LocationMethodSelectorComponent } from './location-method-selector.component';

describe('LocationMethodSelectorComponent', () => {
  it('emits new sources and ignores the active one', () => {
    const component = new LocationMethodSelectorComponent();
    const changes: string[] = [];
    component.valueChange.subscribe(value => changes.push(value));
    component.select('venue');
    component.select('maps');
    component.select('gps');
    expect(changes).toEqual(['maps', 'gps']);
  });

  it('does not change source while disabled', () => {
    const component = new LocationMethodSelectorComponent();
    const spy = spyOn(component.valueChange, 'emit');
    component.disabled = true;
    component.select('maps');
    expect(spy).not.toHaveBeenCalled();
  });
});
