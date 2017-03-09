import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, Subscription } from 'rxjs/Rx';
import { Response } from '@angular/http';
import { BungieHttpService } from './bungie-http.service';
import { Router, ActivatedRoute, Params } from '@angular/router';

@Injectable()
export class GuardianService implements OnDestroy {
  private subParams: Subscription;
  private subSearch: Subscription;
  private subAccount: Subscription;
  private subCharacter: Subscription;
  private subActivityHistory: Subscription;

  private _membershipId: BehaviorSubject<string>;

  public searchName: BehaviorSubject<string>;
  public selectPlatform: BehaviorSubject<boolean>;
  public membershipType: BehaviorSubject<number>;
  public displayName: BehaviorSubject<string>;
  public characters: BehaviorSubject<bungie.Character[]>;
  public characterId: BehaviorSubject<string>;
  public activeCharacter: BehaviorSubject<bungie.Character>;
  public activities: BehaviorSubject<bungie.Activity[]>;
  public activityMode: BehaviorSubject<string>;
  public activityPage: BehaviorSubject<number>;
  public activityId: BehaviorSubject<string>;

  constructor(
    private bHttp: BungieHttpService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this._membershipId = new BehaviorSubject('');
    this.activityMode = new BehaviorSubject('None');
    this.activityPage = new BehaviorSubject(0);

    this.searchName = new BehaviorSubject('');
    this.selectPlatform = new BehaviorSubject(false);
    this.membershipType = new BehaviorSubject(-1);
    this.displayName = new BehaviorSubject('');
    this.characters = new BehaviorSubject([]);
    this.characterId = new BehaviorSubject('');
    this.activeCharacter = new BehaviorSubject(null);
    this.activities = new BehaviorSubject([]);
    this.activityId = new BehaviorSubject('');

    this.subParams = this.route.params
      .subscribe((params: Params) => {
        if (params['membershipType']) {
          this.membershipType.next(+params['membershipType']);
        } else {
          this.membershipType.next(-1);
        }

        if (params['guardian']) {
          this.searchName.next(params['guardian']);
        } else {
          this.searchName.next('');
        }

        if (params['characterId']) {
          this.characterId.next(params['characterId']);
        } else {
          this.characterId.next('');
        }

        if (params['gamemode']) {
          this.activityMode.next(params['gamemode']);
        } else {
          this.activityMode.next('None');
        }

        if (params['page']) {
          this.activityPage.next(+params['page']);
        } else {
          this.activityPage.next(0);
        }
      });

    this.subSearch = Observable.combineLatest(
      this.membershipType,
      this.searchName
    )
      .map(([platform, guardian]) => {
        if (guardian.length) {
          return 'https://www.bungie.net/Platform/Destiny/SearchDestinyPlayer/' + platform + '/' + guardian + '/';
        } else {
          return '';
        }
      })
      .distinctUntilChanged()
      .switchMap((url) => {
        this._membershipId.next('');
        this.selectPlatform.next(false);
        if (url.length) {
          return this.bHttp.get(url)
            .map((res: Response) => res.json())
            .catch((error: any) => Observable.throw(error.json().error || 'Server error'));
        } else {
          return Observable.empty();
        }
      })
      .subscribe((res: bungie.SearchDestinyPlayerResponse) => {
        try {
          let Response = res.Response;
          if (Response.length === 1) {
            this._membershipId.next(Response[0].membershipId);
            this.displayName.next(Response[0].displayName);
            this.membershipType.next(Response[0].membershipType);
          }
          if (Response.length > 1) {
            this.selectPlatform.next(true);
          }
        } catch (e) {
          console.log(e);
        }
      });

    this.subAccount = Observable.combineLatest(
      this.membershipType,
      this._membershipId
    )
      .map(([membershipType, membershipId]) => {
        try {
          if (membershipType && membershipId) {
            return 'https://www.bungie.net/Platform/Destiny/' + membershipType + '/Account/' + membershipId + '/Summary/';
          } else {
            return '';
          }
        } catch (e) {
          return '';
        }
      })
      .distinctUntilChanged()
      .switchMap((url) => {
        this.characters.next(null);
        if (url.length) {
          return this.bHttp.get(url)
            .map((res: Response) => res.json())
            .catch((error: any) => Observable.throw(error.json().error || 'Server error'));
        } else {
          return Observable.empty();
        }
      })
      .subscribe((res: bungie.AccountResponse) => {
        try {
          this.characters.next(res.Response.data.characters);
        } catch (e) {
          console.log(e);
        }
      });

    this.subCharacter = Observable.combineLatest(
      this.characters,
      this.characterId
    )
      .map(([characters, characterId]) => {
        let character = null;
        if (characters && characters.length) {
          if (characterId) {
            character = characters.find(function (char) {
              return char.characterBase.characterId === characterId;
            });
          } else {
            character = characters[0];
          }
        }
        return character;
      })
      .distinctUntilChanged()
      .subscribe((character: bungie.Character) => {
        this.activeCharacter.next(character);
      });

    this.subActivityHistory = Observable.combineLatest(
      this.activeCharacter,
      this.activityMode,
      this.activityPage
    )
      .map(([character, mode, page]) => {
        try {
          let membershipType = character.characterBase.membershipType;
          let membershipId = character.characterBase.membershipId;
          let characterId = character.characterBase.characterId;
          this.characterId.next(characterId);
          return 'https://www.bungie.net/Platform/Destiny/Stats/ActivityHistory/'
            + membershipType + '/' + membershipId + '/' + characterId + '/?mode=' + mode + '&count=7&page=' + page;
        } catch (e) {
          return '';
        }
      })
      .distinctUntilChanged()
      .switchMap((url) => {
        this.activities.next([]);
        if (url.length) {
          return this.bHttp.get(url)
            .map((res: Response) => res.json())
            .catch((error: any) => Observable.throw(error.json().error || 'Server error'));
        } else {
          return Observable.empty();
        }
      })
      .subscribe((res: bungie.ActivityHistoryResponse) => {
        try {
          this.activities.next(res.Response.data.activities);
        } catch (e) {
          console.log(e);
        }
      });
  }

  ngOnDestroy() {
    this.subParams.unsubscribe();
    this.subSearch.unsubscribe();
    this.subAccount.unsubscribe();
    this.subCharacter.unsubscribe();
    this.subActivityHistory.unsubscribe();
  }

}