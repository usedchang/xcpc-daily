#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
void solve(){
    int n;cin>>n;
    vector<array<ll,2>>a(n+2);
    ll S1=0,S=0;
    for(int i=1;i<=n;i++) cin>>a[i][0],S1+=a[i][0],S+=a[i][0];
    for(int i=1;i<=n;i++) cin>>a[i][1],S+=a[i][1];
    int cnt=n/2;
    ll T1=0,T2=0;
    for(int i=1;i<=cnt;i++) T1+=a[i][0];
    for(int i=1;i<=cnt;i++) T1+=a[i][1];
    ll val=max(T1,min(T1+a[cnt+1][0]+a[cnt+1][1],S1));
    if(val*2>S) cout<<"Mandy"<<endl;
    else if(val*2==S) cout<<"draw"<<endl;
    else cout<<"brz"<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}