#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
void solve(){
    int n;cin>>n;
    vector<ll>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    map<ll,ll>mp;
    for(int i=1;i<=n;i++){
        mp[a[i]]++;
        auto itL=mp.begin();
        auto itR=mp.rbegin();
        if(itL->second!=1||mp.size()>2) cout<<itL->first+itR->first<<' ';
        else cout<<2*itR->first<<' ';
    }
    cout<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}